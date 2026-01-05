import { JsonPipe } from '@angular/common';
import { Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import { DatosDni } from '../../models/datos-dni';
import { QRDataParserService } from '../../services/qr-data-parser.service';
import { QRReaderService } from '../../services/qr-reader.service';

@Component({
  selector: 'app-midni-qr-reader',
  standalone: true,
  imports: [JsonPipe],
  templateUrl: './midni-qr-reader.component.html'
})
export class MidniQrReaderComponent implements OnDestroy {

  private readerService = inject(QRReaderService);
  private parserService = inject(QRDataParserService);

  @ViewChild('video', { static: false }) video!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas', { static: false }) canvas!: ElementRef<HTMLCanvasElement>;

  private stream?: MediaStream;
  public scanning = false;

  data?: DatosDni;
  imageUrl?: string | null;
  error?: string;

  ngOnDestroy(): void {
    this.stopCamera();
    this.revokeImageUrl();
  }

  async startCamera(): Promise<void> {
    try {
      this.error = undefined;
      this.data = undefined;
      this.revokeImageUrl();
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      this.video.nativeElement.srcObject = this.stream;
      this.scanning = true;

      this.scanLoop();
    } catch {
      this.error = 'No se pudo acceder a la cámara';
    }
  }


  private stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = undefined;
    }
    this.scanning = false;
  }

  private revokeImageUrl(): void {
    if (this.imageUrl) {
      URL.revokeObjectURL(this.imageUrl);
      this.imageUrl = undefined;
    }
  }

  triggerFileInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    this.stopCamera(); // Stop camera if running
    this.error = undefined;
    this.data = undefined;
    this.revokeImageUrl();

    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    // Reset input value to allow selecting the same file again
    input.value = '';

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      const canvas = this.canvas.nativeElement;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      await this.scanImageData(imageData);
    };

    img.onerror = () => {
      this.error = 'Error al cargar la imagen';
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }

  private async scanLoop(): Promise<void> {
    if (!this.scanning) return;

    const video = this.video.nativeElement;
    const canvas = this.canvas.nativeElement;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(
        0, 0, canvas.width, canvas.height
      );

      const found = await this.scanImageData(imageData);
      if (found) return; // Stop loop if found (scanImageData handles stopCamera calls for success)
    }

    requestAnimationFrame(() => this.scanLoop());
  }

  private async scanImageData(imageData: ImageData): Promise<boolean> {
    try {
      const results = await this.readerService.read(imageData);

      if (results.length > 0 && results[0].bytes) {
        this.stopCamera(); // Stop scanning on success
        await this.processResult(results[0].bytes);
        return true;
      }
    } catch (e) {
      console.error('Error reading barcode', e);
    }
    return false;
  }

  private async processResult(bytes: Uint8Array): Promise<void> {
    const certificados = new Map<string, string>();

    // APPDNIMOVIL.cer
    certificados.set(
      '4d393eec9ad3289964d22fb9f744a884',
      `-----BEGIN CERTIFICATE-----
MIIINjCCBh6gAwIBAgIQTTk+7JrTKJlk0i+590SohDANBgkqhkiG9w0BAQsFADB0
MQswCQYDVQQGEwJFUzEoMCYGA1UECgwfRElSRUNDSU9OIEdFTkVSQUwgREUgTEEg
UE9MSUNJQTEMMAoGA1UECwwDQ05QMRgwFgYDVQRhDA9WQVRFUy1TMjgxNjAxNUgx
EzARBgNVBAMMCkFDIERHUCAwMDQwHhcNMjMwODA4MTIwNjE3WhcNMjgwODA4MTIw
NjE3WjCBoDELMAkGA1UEBhMCRVMxIDAeBgNVBAoMF01JTklTVEVSSU8gREVMIElO
VEVSSU9SMRowGAYDVQQLDBFTRUxMTyBFTEVDVFJPTklDTzEjMCEGA1UECwwaQ1VF
UlBPIE5BQ0lPTkFMIERFIFBPTElDSUExGDAWBgNVBGEMD1ZBVEVTLVMyODE2MDE1
SDEUMBIGA1UEAwwLQVBQRE5JTU9WSUwwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNC
AAT8njUOVXTgAVw+Xax6LIk/Cl7872FA5dHwo9Hgo5+xQKFR0Pyemcad4iVehc9f
jYZlsyNpm/AAbMOUt9on/C4No4IEYDCCBFwwDAYDVR0TAQH/BAIwADAOBgNVHQ8B
Af8EBAMCBeAwHQYDVR0OBBYEFJa0gLQSBvace99OwNNErvWqMwlRMB8GA1UdIwQY
MBaAFA2n5MC015fkdNyGfFL+9N4yYjK8MIG6BggrBgEFBQcBAwSBrTCBqjAIBgYE
AI5GAQEwCwYGBACORgEDAgEPMAgGBgQAjkYBBDATBgYEAI5GAQYwCQYHBACORgEG
AjByBgYEAI5GAQUwaDAyFixodHRwczovL3BraS5wb2xpY2lhLmVzL2NucC9wdWJs
aWNhY2lvbmVzL3BkcxMCZW4wMhYsaHR0cHM6Ly9wa2kucG9saWNpYS5lcy9jbnAv
cHVibGljYWNpb25lcy9wZHMTAmVzMGkGCCsGAQUFBwEBBF0wWzAiBggrBgEFBQcw
AYYWaHR0cDovL29jc3AucG9saWNpYS5lczA1BggrBgEFBQcwAoYpaHR0cDovL3Br
aS5wb2xpY2lhLmVzL2NucC9jZXJ0cy9BQzAwNC5jcnQwggEuBgNVHSAEggElMIIB
ITCCAQYGCGCFVAECAWY5MIH5MDcGCCsGAQUFBwIBFitodHRwOi8vcGtpLnBvbGlj
aWEuZXMvY25wL3B1YmxpY2FjaW9uZXMvZHBjMIG9BggrBgEFBQcCAjCBsAyBrVFD
Qzogc2VsbG8gZWxlY3Ryw7NuaWNvIGRlIEFkbWluaXN0cmFjacOzbiwgw7NyZ2Fu
byBvIGVudGlkYWQgZGUgZGVyZWNobyBww7pibGljbywgbml2ZWwgYWx0by4gQ29u
c3VsdGUgbGFzIGNvbmRpY2lvbmVzIGRlIHVzbyBlbiBodHRwOi8vcGtpLnBvbGlj
aWEuZXMvY25wL3B1YmxpY2FjaW9uZXMvZHBjMAkGBwQAi+xAAQMwCgYIYIVUAQMF
BgEwgbUGA1UdHwSBrTCBqjCBp6AqoCiGJmh0dHA6Ly9wa2kucG9saWNpYS5lcy9j
bnAvY3Jscy9DUkwuY3JsonmkdzB1MQswCQYDVQQGEwJFUzEoMCYGA1UECgwfRElS
RUNDSU9OIEdFTkVSQUwgREUgTEEgUE9MSUNJQTEMMAoGA1UECwwDQ05QMRgwFgYD
VQRhDA9WQVRFUy1TMjgxNjAxNUgxFDASBgNVBAMMC0FSQyBER1AgMDAyMIHKBgNV
HREEgcIwgb+BDnBraUBwb2xpY2lhLmVzpDIwMDEuMCwGCWCFVAEDBQYBARYfU0VM
TE8gRUxFQ1RST05JQ08gREUgTklWRUwgQUxUT6Q7MDkxNzA1BglghVQBAwUGAQIW
KEFNQklUTyBERUwgQ1VFUlBPIE5BQ0lPTkFMIERFIExBIFBPTElDSUGkHDAaMRgw
FgYJYIVUAQMFBgEDFglTMjgxNjAxNUikHjAcMRowGAYJYIVUAQMFBgEFFgtBUFBE
TklNT1ZJTDAdBgNVHSUEFjAUBggrBgEFBQcDBAYIKwYBBQUHAwIwDQYJKoZIhvcN
AQELBQADggIBAHIDEYeMYDbFyvxqIGUqe8HIY/+pHZ2X73A6KZTQzNewRvgBAysf
/3fL3OTb8gdu1Cd14blezPP75OvUOSzA1noSlRhsu9M0n1yhKGiTbXoOzIvvyUt3
FBHLggPpUohHIWJoEo4vR1bWrzsh+jCzjQ36IZfaRd9rdqa2IpQs68z7OJz0Jl+K
shZR32t/wjaLmYZUy/YPpe2Uf1DNeMm5hsIseO4I5lm5zjJqwqXyP/aMoMPZzkCO
Y2kpOeG7WUd1q4NvVq888rbI6alpmC+Air5vDtbqUL7pkOUE7gK7iYbpmL8pTIVh
lP4V3QshS3zj3JOG06e43IIDYHUNjTEDP6IfOw8Z8D5iJAfvbRXOqGD+rlgIgK4S
p1Z2cWr5XxLAzO6GdfL5fAu5aGWgUxi24N44Y/xhhPcpzgBWAc8B4AHXAcfHnJ3z
vQz5h8plZQvVm/qZ87xAgVKfzJ0HxOcoEhWbe3hbV877sPMZLkvT+9jhCI2iVHQ/
vGk3btBAMUHOz8tyOxEa/Xs8/GTPX4PGRxwBoFX70A/wRWVUPk0TGjqOSR4Oza0x
vAUFHRTU8Lnm7HQi5Zmdjtzl7ZUex18XfzP17my6x1RMWIC5Vs1cDQZl5mMUQkXq
6D9FbXIgc0NJLPhTQh/BKkECCMj4d7QlOdJFc8Vkhp6FK+htvEVC2w/I
-----END CERTIFICATE-----
`);

    // APPDNIMOVIL_pruebas.cer
    certificados.set(
      '41b02f420c705d9a6662f8c1559c27c5',
      `-----BEGIN CERTIFICATE-----
MIIIUTCCBjmgAwIBAgIQQbAvQgxwXZpmYvjBVZwnxTANBgkqhkiG9w0BAQsFADB0
MQswCQYDVQQGEwJFUzEoMCYGA1UECgwfRElSRUNDSU9OIEdFTkVSQUwgREUgTEEg
UE9MSUNJQTEMMAoGA1UECwwDQ05QMRgwFgYDVQRhDA9WQVRFUy1TMjgxNjAxNUgx
EzARBgNVBAMMCkFDIERHUCAwMDQwHhcNMjQwNjA3MTIxMDQwWhcNMjYwOTEwMTIx
MDQwWjCBozELMAkGA1UEBhMCRVMxIDAeBgNVBAoTF01JTklTVEVSSU8gREVMIElO
VEVSSU9SMRowGAYDVQQLExFTRUxMTyBFTEVDVFJPTklDTzEjMCEGA1UECxMaQ1VF
UlBPIE5BQ0lPTkFMIERFIFBPTElDSUExGDAWBgNVBGETD1ZBVEVTLVMyODE2MDE1
SDEXMBUGA1UEAxMOQVBQRE5JTU9WSUxQUkUwWTATBgcqhkjOPQIBBggqhkjOPQMB
BwNCAARBfpojvXY9rbDS0VB2THZuTjX7Ii807tkKnAZZwbIOEt3FdGykeOHv9tt5
PxPD/kr2io50wL1r2MGawBTo7wBpo4IEeDCCBHQwDAYDVR0TAQH/BAIwADAOBgNV
HQ8BAf8EBAMCA8gwHQYDVR0OBBYEFFIE+56N46OfWO0z/Yw9z3GQmIcmMB8GA1Ud
IwQYMBaAFA2n5MC015fkdNyGfFL+9N4yYjK8MIG6BggrBgEFBQcBAwSBrTCBqjAI
BgYEAI5GAQEwCwYGBACORgEDAgEPMAgGBgQAjkYBBDATBgYEAI5GAQYwCQYHBACO
RgEGAjByBgYEAI5GAQUwaDAyFixodHRwczovL3BraS5wb2xpY2lhLmVzL2NucC9w
dWJsaWNhY2lvbmVzL3BkcxMCZW4wMhYsaHR0cHM6Ly9wa2kucG9saWNpYS5lcy9j
bnAvcHVibGljYWNpb25lcy9wZHMTAmVzMGkGCCsGAQUFBwEBBF0wWzAiBggrBgEF
BQcwAYYWaHR0cDovL29jc3AucG9saWNpYS5lczA1BggrBgEFBQcwAoYpaHR0cDov
L3BraS5wb2xpY2lhLmVzL2NucC9jZXJ0cy9BQzAwNC5jcnQwggE5BgNVHSAEggEw
MIIBLDCCAQYGCGCFVAECAWY5MIH5MDcGCCsGAQUFBwIBFitodHRwOi8vcGtpLnBv
bGljaWEuZXMvY25wL3B1YmxpY2FjaW9uZXMvZHBjMIG9BggrBgEFBQcCAjCBsAyB
rVFDQzogc2VsbG8gZWxlY3Ryw7NuaWNvIGRlIEFkbWluaXN0cmFjacOzbiwgw7Ny
Z2FubyBvIGVudGlkYWQgZGUgZGVyZWNobyBww7pibGljbywgbml2ZWwgYWx0by4g
Q29uc3VsdGUgbGFzIGNvbmRpY2lvbmVzIGRlIHVzbyBlbiBodHRwOi8vcGtpLnBv
bGljaWEuZXMvY25wL3B1YmxpY2FjaW9uZXMvZHBjMAkGBwQAi+xAAQMwCgYIYIVU
AQMFBgEwCQYHZ4EMAQUCAjCBtQYDVR0fBIGtMIGqMIGnoCqgKIYmaHR0cDovL3Br
aS5wb2xpY2lhLmVzL2NucC9jcmxzL0NSTC5jcmyieaR3MHUxCzAJBgNVBAYTAkVT
MSgwJgYDVQQKDB9ESVJFQ0NJT04gR0VORVJBTCBERSBMQSBQT0xJQ0lBMQwwCgYD
VQQLDANDTlAxGDAWBgNVBGEMD1ZBVEVTLVMyODE2MDE1SDEUMBIGA1UEAwwLQVJD
IERHUCAwMDIwgdcGA1UdEQSBzzCBzIEYZGVzYXJyb2xsb2FwcEBwb2xpY2lhLmVz
pDIwMDEuMCwGCWCFVAEDBQYBARYfU0VMTE8gRUxFQ1RST05JQ08gREUgTklWRUwg
QUxUT6Q7MDkxNzA1BglghVQBAwUGAQIWKEFNQklUTyBERUwgQ1VFUlBPIE5BQ0lP
TkFMIERFIExBIFBPTElDSUGkHDAaMRgwFgYJYIVUAQMFBgEDFglTMjgxNjAxNUik
ITAfMR0wGwYJYIVUAQMFBgEFFg5BUFBETklNT1ZJTFBSRTAdBgNVHSUEFjAUBggr
BgEFBQcDBAYIKwYBBQUHAwIwDQYJKoZIhvcNAQELBQADggIBAHewPexkoHe/Ei5B
NdHX3OeOPUi62UFGl+kAcLP7lDU8ySuHXGKhJVZGF/DTZtGdfiuNdWv7ECiEXw2g
xoWh9uqQIg0NbqKT7kxgnRSHOd4cPX3JDcnR8ZyBcOdlpmSxT1XAXjw1k3orbncp
4SyOq6mCb2Z6HJp2Vp0yBf6EAgSUpc4//+L5VCzjOEOpXGBIa4K+mr6e3qFHvg9X
1NCLHG+cc8NUFgDOhi2IvgwezYX85xiQO2ZEaEvMnfdJCDJpY/UQYrGCeLuCJ2qL
hkSfRaoDJe84WWmEvZOx8PySXaNlv3ABODj0rqA6EA+NicLYnh+DrQluWMvb1a2W
J6tBbsB8UnlSaU6p944cKmchgZYFLLnkqXwFr3T/rO42dJylBLMT0T+FR8YC0xdJ
kDDuAgnSOVa/SGrMQbZzoF17eNhkdALrjYlUffqob6XTrtaWsSnFqBh2YNNxsgMt
T78oOvH/34oHd9XXaW9YhLXKnO1QFiJXgJBwaB15bD9HwR0U344BRyMhr7Yk3coK
eD/S6wyAjx/dNyNejvO9CQU+m0ZMJJtPoGQFaootg+V3OWTJpEd+YJS5e9jPH986
hDtFvGVC+E3ZOqJJX0U+ghCkX18rgDyUiMMYZm41N99TYlA1O97V7Na+3uSVzTbX
XJHrxesIdfRxS7HdLNFOrOgczZYP
-----END CERTIFICATE-----
`);

    // Ejemplos_PDF.cer -> Certificado de MiDNI-FormatoQR_v107_sc_PN.pdf
    certificados.set(
      '2274948240b9368f65e5c80febfe5ce4',
      `-----BEGIN CERTIFICATE-----
MIIIPDCCBiSgAwIBAgIQInSUgkC5No9l5cgP6/5c5DANBgkqhkiG9w0BAQsFADB0MQswCQYDVQQGEwJF
UzEoMCYGA1UECgwfRElSRUNDSU9OIEdFTkVSQUwgREUgTEEgUE9MSUNJQTEMMAoGA1UECwwDQ05QMRgw
FgYDVQRhDA9WQVRFUy1TMjgxNjAxNUgxEzARBgNVBAMMCkFDIERHUCAwMDQwHhcNMjQwMzA0MTMwOTM1
WhcNMjkwMzA0MTMwOTM1WjCBozELMAkGA1UEBhMCRVMxIDAeBgNVBAoTF01JTklTVEVSSU8gREVMIElO
VEVSSU9SMRowGAYDVQQLExFTRUxMTyBFTEVDVFJPTklDTzEjMCEGA1UECxMaQ1VFUlBPIE5BQ0lPTkFM
IERFIFBPTElDSUExGDAWBgNVBGETD1ZBVEVTLVMyODE2MDE1SDEXMBUGA1UEAxMOQVBQRE5JTU9WSUxQ
UkUwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAARBfpojvXY9rbDS0VB2THZuTjX7Ii807tkKnAZZwbIO
Et3FdGykeOHv9tt5PxPD/kr2io50wL1r2MGawBTo7wBpo4IEYzCCBF8wDAYDVR0TAQH/BAIwADAOBgNV
HQ8BAf8EBAMCBeAwHQYDVR0OBBYEFFIE+56N46OfWO0z/Yw9z3GQmIcmMB8GA1UdIwQYMBaAFA2n5MC0
15fkdNyGfFL+9N4yYjK8MIG6BggrBgEFBQcBAwSBrTCBqjAIBgYEAI5GAQEwCwYGBACORgEDAgEPMAgG
BgQAjkYBBDATBgYEAI5GAQYwCQYHBACORgEGAjByBgYEAI5GAQUwaDAyFixodHRwczovL3BraS5wb2xp
Y2lhLmVzL2NucC9wdWJsaWNhY2lvbmVzL3BkcxMCZW4wMhYsaHR0cHM6Ly9wa2kucG9saWNpYS5lcy9j
bnAvcHVibGljYWNpb25lcy9wZHMTAmVzMGkGCCsGAQUFBwEBBF0wWzAiBggrBgEFBQcwAYYWaHR0cDov
L29jc3AucG9saWNpYS5lczA1BggrBgEFBQcwAoYpaHR0cDovL3BraS5wb2xpY2lhLmVzL2NucC9jZXJ0
cy9BQzAwNC5jcnQwggEuBgNVHSAEggElMIIBITCCAQYGCGCFVAECAWY5MIH5MDcGCCsGAQUFBwIBFito
dHRwOi8vcGtpLnBvbGljaWEuZXMvY25wL3B1YmxpY2FjaW9uZXMvZHBjMIG9BggrBgEFBQcCAjCBsAyB
rVFDQzogc2VsbG8gZWxlY3Ryw7NuaWNvIGRlIEFkbWluaXN0cmFjacOzbiwgw7NyZ2FubyBvIGVudGlk
YWQgZGUgZGVyZWNobyBww7pibGljbywgbml2ZWwgYWx0by4gQ29uc3VsdGUgbGFzIGNvbmRpY2lvbmVz
IGRlIHVzbyBlbiBodHRwOi8vcGtpLnBvbGljaWEuZXMvY25wL3B1YmxpY2FjaW9uZXMvZHBjMAkGBwQA
i+xAAQMwCgYIYIVUAQMFBgEwgbUGA1UdHwSBrTCBqjCBp6AqoCiGJmh0dHA6Ly9wa2kucG9saWNpYS5l
cy9jbnAvY3Jscy9DUkwuY3JsonmkdzB1MQswCQYDVQQGEwJFUzEoMCYGA1UECgwfRElSRUNDSU9OIEdF
TkVSQUwgREUgTEEgUE9MSUNJQTEMMAoGA1UECwwDQ05QMRgwFgYDVQRhDA9WQVRFUy1TMjgxNjAxNUgx
FDASBgNVBAMMC0FSQyBER1AgMDAyMIHNBgNVHREEgcUwgcKBDnBraUBwb2xpY2lhLmVzpDIwMDEuMCwG
CWCFVAEDBQYBARYfU0VMTE8gRUxFQ1RST05JQ08gREUgTklWRUwgQUxUT6Q7MDkxNzA1BglghVQBAwUG
AQIWKEFNQklUTyBERUwgQ1VFUlBPIE5BQ0lPTkFMIERFIExBIFBPTElDSUGkHDAaMRgwFgYJYIVUAQMF
BgEDFglTMjgxNjAxNUikITAfMR0wGwYJYIVUAQMFBgEFFg5BUFBETklNT1ZJTFBSRTAdBgNVHSUEFjAU
BggrBgEFBQcDBAYIKwYBBQUHAwIwDQYJKoZIhvcNAQELBQADggIBADRybjPKB0n/vmbyRnnZ5FgYp1qt
F/UaozwxcwgAGpcxIFxNC9iqohC6DrAC6pO9MUzdbzB3VnKam6/gYsNJmXAkPf/2SEuZJBTqP3HlrRet
PPJ+BsTRDueN4nA5MWj7GGpYIvjci15Iz1RONgOrZpG2wT6kTH07KM7dJ0e2q0+iU4JH3dj9eFcNd+cs
NjOrWFTS55gDU2Pxjul33r1d2Vi3ymBpQCzgxX7RczwgYcrmtiWFbwpqc/ZmIqrqt6jI2vV2cxRr4s4v
wKY3RQf2rRvhF/39o9YvYUyjxWaR9/DjhF+LdOBUSJhU0OyAjvOYTtYHThWjMWAKEUrUU4ilBgbFZTwS
aFXCSB7kMAImMt93tmhzAx0lBfYP4NRK/H8L4cr1mnvqNI2NFGWiYFlIcySKcyqGqNjn7zlgQdRotnW1
rqvhe0UyQuO98uVkSBN3Xzo6VGTgVBEVquwP1QT9lgv5+7LtaycjKpADmX3m4tdf/whnHCtKVUpWA+iq
Pwjytqef2VjzoQIWX2knt2uHMHRBmt6ktR5vKelv0ewEZloYCsT+2SPuo3rpd9EOJkLl02O9UG7T0lhw
1UvFkJ5wMfjK8+gc/5x5hGe8Fzcg4culTrIBTTq2HhQ45wBHRYUXNNOHGyi0AqC0Vo5JnB6NjDXkMkQr
WGmckU12Ztc72pg0
-----END CERTIFICATE-----
`);

    const parsed = await this.parserService.parse(bytes, certificados);

    this.data = parsed;
    this.imageUrl = parsed.FotoUrl;

    //if (parsed.NumeroDNI)
    //  this.downloadFile(bytes, `${parsed.NumeroDNI}.qr`);

  }

  downloadFile(data: Uint8Array, filename: string, mimeType: string = 'application/octet-stream') {
    // Crear un Blob a partir del Uint8Array
    const blob = new Blob([data.slice().buffer], { type: mimeType });

    // Crear un enlace temporal
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;

    // Disparar la descarga
    document.body.appendChild(a);
    a.click();

    // Limpiar
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

