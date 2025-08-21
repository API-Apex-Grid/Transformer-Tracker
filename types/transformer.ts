export interface Transformer {
  region: string;
  transformerNumber: string;
  poleNumber: string;
  type: string;
  location: string;
  sunnyImage?: File | string | null;
  cloudyImage?: File | string | null;
  windyImage?: File | string | null;
}
