import { HeaderInfo } from "./header-info";

export interface DatosDni {
  TipoVerificacion: string;
  NumeroDNI: string;
  FechaNacimiento: string;
  Nombre: string;
  Apellidos: string;
  Sexo: string;
  FechaCaducidad: string;
  Foto: string;
  direccion: string;
  LugarDomicilio1: string;
  LugarDomicilio2: string;
  LugarDomicilio3: string;
  LugarNacimiento1: string;
  LugarNacimiento2: string;
  LugarNacimiento3: string;
  Nacionalidad: string;
  Padres: string;
  NumeroSoporte: string;
  MayorEdadd: string;
  CaducidadQR: string;
  FotoUrl: string;
  ReferenciaCertificado: string;
  SignatureVerified: boolean;

  Header: HeaderInfo;
}
