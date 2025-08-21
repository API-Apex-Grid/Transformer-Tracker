export interface Transformer {
  id?: string;
  region: string;
  transformerNumber: string;
  poleNumber: string;
  type: string;
  location: string;
  sunnyImage?: string | null;
  cloudyImage?: string | null;
  windyImage?: string | null;
}
