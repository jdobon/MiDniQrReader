# 📌 **Resumen de los puntos principales del proyecto MiDniQrReader**

## 🧭 **Propósito del proyecto**
- Aplicación web en **Angular** para **leer, analizar y validar** los códigos QR del **DNI español** en la app oficial **MiDNI**.
- Verifica la **autenticidad** y **integridad** de los datos mediante certificados oficiales del Ministerio del Interior.
- Permite **escaneo en tiempo real** con cámara o subida de archivos.

---

## 🏗️ **Arquitectura y componentes clave**
### **Componentes principales**
- **AppComponent**: contenedor raíz.
- **MidniQrReaderComponent**: interfaz y lógica del lector QR.
- **QRReaderService**: detección de códigos QR usando *zxing-wasm*.
- **QRDataParserService**: parseo de datos, decodificación C40, conversión de imagen JPEG2000 y verificación criptográfica.

### **Modelos de datos**
- **DatosDni**: estructura final con datos del DNI y estado de validación.
- **HeaderInfo**: metadatos del documento y firma.

---

## 🔐 **Seguridad y certificados**
- Usa **tres certificados X.509** embebidos:
  - Producción: *APPDNIMOVIL.cer*
  - Pruebas: *APPDNIMOVIL_pruebas.cer*
  - Ejemplos: *Ejemplos_PDF.cer*
- Todos emitidos por **AC DGP 004** (Dirección General de la Policía).
- Verificación de firma mediante **pkijs** y **asn1js**.

---

## 🧩 **Tecnologías utilizadas**
| Categoría | Tecnología | Uso |
|----------|------------|-----|
| Framework | Angular 20.3 | Estructura de la app |
| Lenguaje | TypeScript 5.9 | Lógica de la aplicación |
| QR | zxing‑wasm | Lectura QR en WebAssembly |
| Criptografía | pkijs, asn1js | Verificación de firma |
| Imágenes | jpeg2000 | Conversión JPEG2000→PNG |
| Testing | Karma, Jasmine | Pruebas unitarias |

---

## 🔄 **Flujo de procesamiento**
1. **Entrada**: cámara o archivo.
2. **Renderizado** en canvas.
3. **Detección QR** con *zxing-wasm*.
4. **Parseo** de bytes:
   - extracción de cabecera
   - decodificación C40
   - conversión de foto
5. **Validación criptográfica**.
6. **Salida**: objeto `DatosDni` con bandera `SignatureVerified`.

---

## 🚀 **Build y desarrollo**
- `npm start` → servidor de desarrollo.
- `npm run build` → build de producción.

---

## 🧩 **Integración con Visual Studio**
- Incluye archivo `.sln` para abrir el proyecto en Visual Studio, aunque puede usarse cualquier editor.

---
