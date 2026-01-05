import { Injectable } from '@angular/core';
import * as asn1js from "asn1js";
import { Buffer } from 'buffer';
import { JpxImage } from 'jpeg2000';
import * as pkijs from "pkijs";
import { DatosDni } from '../models/datos-dni';
import { HeaderInfo } from '../models/header-info';

@Injectable({
  providedIn: 'root',
})
export class QRDataParserService {

  private data!: Uint8Array;
  private fields = new Map<number, Uint8Array>();
  private signature!: Uint8Array;
  private headerInfo!: HeaderInfo;

  async parse(data: Uint8Array, certificados: Map<string, string>): Promise<DatosDni> {
    this.data = data;

    if (data[0] !== 0xDC) throw new Error('Documento no reconocido');
    if (data[1] !== 0x03) throw new Error('Versión de documento no soportada');

    this.headerInfo = {
      Version: 0,
      PaisExpedidor: '',
      IdFirmante: '',
      ReferenciaCertificado: '',
      FechaEmision: '',
      FechaFirma: '',
      TipoVerificacion: 0,
      CategoriaDocumento: 0
    };

    this.headerInfo.Version = data[1];
    this.headerInfo.PaisExpedidor = this.decodeC40(2, 2);
    const datosFirmante = this.decodeC40(4, 4);

    // Bytes de la referencia del certificado
    const bytes = this.hexStringToBytes(datosFirmante.substring(datosFirmante.length - 2));

    // para codificar "bytes" son necesarios "offset" bytes en c40
    const offset = Math.floor((bytes[0] + 2) / 3) * 2;

    this.headerInfo.ReferenciaCertificado = this.decodeC40(8, offset);

    // ES + PN
    this.headerInfo.IdFirmante = datosFirmante.substring(0, datosFirmante.length - 2);

    this.headerInfo.FechaEmision = this.extractDate(8 + offset)
      .toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
    this.headerInfo.FechaFirma = this.extractDate(11 + offset)
      .toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });

    // 7 simple, 8 completa, 9 edad
    this.headerInfo.TipoVerificacion = data[14 + offset];

    // 9 DNI de España
    this.headerInfo.CategoriaDocumento = data[15 + offset];

    this.fields.clear();
    let pos = 16 + offset;
    let datosVerificar: Uint8Array | null = null;

    while (pos < data.length) {
      const fieldId = data[pos++];

      if (fieldId === 0xff) {
        datosVerificar = data.slice(0, pos - 1);
      }

      let length = data[pos++];

      // La longitud va en el siguiente byte
      if (length === 0x81) {
        length = data[pos++];
      // La longitud va en 2 bytes
      } else if (length === 0x82) {
        length = (data[pos++] << 8) | data[pos++];
      }

      const fieldData = data.slice(pos, pos + length);
      pos += length;

      if (fieldId === 0xff) {
        this.signature = fieldData;
        break;
      } else {
        this.fields.set(fieldId, fieldData);
      }
    }

    const result = await this.mapearResultado();

    // Verificación de firma
    if (datosVerificar && this.signature) {
      const certificado = certificados.get(this.headerInfo.ReferenciaCertificado.toLowerCase());
      if (certificado) {
        result.SignatureVerified = await this.verificarFirma(certificado, datosVerificar, this.signature);
      } else {
        result.SignatureVerified = false;
      }
    }

    return result;
  }

  private hexStringToBytes(hex: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return bytes;
  }

  private decodeC40(offset: number, length: number): string {
    const charSet = "*** 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const buffer = this.data.slice(offset, offset + length);
    const result: string[] = [];

    for (let pos = 0; pos + 1 < buffer.length; pos += 2) {
      const shortValue = (buffer[pos] << 8) | buffer[pos + 1];
      const value = shortValue - 1;

      if (value >= 0xfe00) {
        const charIndex = shortValue;
        result.push(charSet.charAt(charIndex));
      } else {
        const firstIndex = Math.floor(value / 1600);
        result.push(charSet.charAt(firstIndex));
        const secondIndex = Math.floor((value % 1600) / 40);
        result.push(charSet.charAt(secondIndex));
        const thirdIndex = value % 40;
        if (thirdIndex > 0) result.push(charSet.charAt(thirdIndex));
      }
    }

    return result.join('');
  }

  private extractDate(offset: number): Date {
    const value = (this.data[offset] << 16) | (this.data[offset + 1] << 8) | this.data[offset + 2];
    const year = value % 10000;
    const month = Math.floor(value / 1000000) - 1;
    const day = Math.floor(value / 10000) % 100;
    return new Date(year, month, day);
  }

  private async mapearResultado(): Promise<DatosDni> {

    const fotoJpeg2000 = this.fields.get(0x50)!;
    const fotoPng: Uint8Array = await this.jp2ToPng(fotoJpeg2000);
    const blob = new Blob([Buffer.from(fotoPng).buffer], { type: 'image/png' });
    const fotoUrl = URL.createObjectURL(blob);

    const fotoBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(
        (reader.result as string).split(',')[1]
      );
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const getField = (fieldId: number): string =>
      new TextDecoder().decode(this.fields.get(fieldId));

    return {
      TipoVerificacion: this.tipoVerificacion(),
      NumeroDNI: getField(0x40),
      FechaNacimiento: this.parseUtcDate(getField(0x42))
        ?.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }) ?? '',
      Nombre: getField(0x44),
      Apellidos: getField(0x46),
      Sexo: getField(0x48),
      FechaCaducidad: this.parseUtcDate(getField(0x4c))
        ?.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }) ?? '',
      Foto: fotoBase64,
      direccion: getField(0x60),
      LugarDomicilio1: getField(0x72),
      LugarDomicilio2: getField(0x74),
      LugarDomicilio3: getField(0x76),
      LugarNacimiento1: getField(0x62),
      LugarNacimiento2: getField(0x78),
      LugarNacimiento3: getField(0x7a),
      Nacionalidad: getField(0x64),
      Padres: getField(0x66),
      NumeroSoporte: getField(0x68),
      MayorEdadd: this.mayor18(),
      CaducidadQR: this.parseUtcDate(getField(0x80))!
        .toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
      FotoUrl: fotoUrl,
      ReferenciaCertificado: this.headerInfo.ReferenciaCertificado,
      SignatureVerified: false,
      Header: this.headerInfo
    };
  }

  private parseUtcDate(value: string): Date | null {
    if (!value) {
      return null;
    }

    const [datePart, timePart] = value.trim().split(' ');

    const [day, month, year] = datePart.split('-').map(Number);

    let hour = 0;
    let minute = 0;
    let second = 0;

    if (timePart) {
      const timeParts = timePart.split(':').map(Number);
      hour = timeParts[0] ?? 0;
      minute = timeParts[1] ?? 0;
      second = timeParts[2] ?? 0;
    }

    // Fecha interpretada SIEMPRE como UTC
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }

  private tipoVerificacion(): string {
    const docType = this.headerInfo.TipoVerificacion;

    if (docType === 0x09) {
      return "EDAD";
    }
    if (docType === 0x07) {
      return "SIMPLE";
    }
    if (docType === 0x08) {
      return "COMPLETO";
    }

    return '';
  }

  private mayor18(): string {
    const legalAgeData = this.fields.get(0x70);
    if (!legalAgeData || legalAgeData.length === 0) return '';

    try {
      // Convertimos el Uint8Array a número
      let intValue = 0;
      for (let i = 0; i < legalAgeData.length; i++) {
        intValue = (intValue << 8) | legalAgeData[i];
      }

      return intValue === 1 ? "MAYOR_EDAD" : "MENOR_18";
    } catch (error) {
      console.error("Error determining legal age:", error);
    }

    return '';
  }

  private async jp2ToPng(data: Uint8Array): Promise<Uint8Array> {
    const buffer = Buffer.from(data);

    const jpx = new JpxImage();
    jpx.parse(buffer);

    const width = jpx.width;
    const height = jpx.height;
    const components = jpx.componentsCount;

    const rComp = jpx.tiles[0].items;
    const gComp = components > 1 ? jpx.tiles[1].items : rComp;
    const bComp = components > 2 ? jpx.tiles[2].items : rComp;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imageData = ctx.createImageData(width, height);

    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      imageData.data[o] = rComp[i];
      imageData.data[o + 1] = gComp[i];
      imageData.data[o + 2] = bComp[i];
      imageData.data[o + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob>(resolve =>
      canvas.toBlob(b => resolve(b!), 'image/png')
    );

    return new Uint8Array(await blob.arrayBuffer());
  }

  private base64ToArrayBuffer(b64: string): ArrayBuffer {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async importECPublicKeyFromCert(certB64: string): Promise<CryptoKey> {
    const der = this.base64ToArrayBuffer(certB64);

    const asn1 = asn1js.fromBER(der);
    const cert = new pkijs.Certificate({ schema: asn1.result });

    return crypto.subtle.importKey(
      "spki",
      cert.subjectPublicKeyInfo.toSchema().toBER(false),
      {
        name: "ECDSA",
        namedCurve: "P-256"
      },
      false,
      ["verify"]
    );
  }

  private async verificarFirma(certB64: string, data: Uint8Array, signature: Uint8Array): Promise<boolean> {

    try {
      const publicKey = await this.importECPublicKeyFromCert(certB64
        .replace("-----BEGIN CERTIFICATE-----", "")
        .replace("-----END CERTIFICATE-----", "")
        .replace(/\s+/g, ""));

      // signature = r || s (64 bytes)
      if (signature.length !== 64) {
        throw new Error("Firma ECDSA inválida");
      }

      return crypto.subtle.verify(
        {
          name: "ECDSA",
          hash: "SHA-256"
        },
        publicKey,
        signature.buffer as ArrayBuffer,
        data.buffer as ArrayBuffer
      );
    } catch (ex) {
      console.error("Error verifying signature:", ex);
      return false;
    }
  }
}
