export const TRANSFORMER_REMOVED_EVENT = "transformer:removed" as const;

export type TransformerRemovedDetail = {
  id?: string | null;
  transformerNumber?: string | null;
};

export const dispatchTransformerRemoved = (detail: TransformerRemovedDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TRANSFORMER_REMOVED_EVENT, { detail }));
};
