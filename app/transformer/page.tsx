"use client";

import { useState } from "react";
import AddTransformerModal from "@/components/AddTransformerModal";
import TransformerList from "@/components/TransformerList";

export interface Transformer {
  region: string;
  transformerNumber: string;
  poleNumber: string;
  type: string;
  location: string;
}

const TransformerPage = () => {
  const [transformers, setTransformers] = useState<Transformer[]>([
   
  ]);

  const addTransformer = (transformer: Transformer) => {
    setTransformers([...transformers, transformer]);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Transformers</h1>
      <AddTransformerModal addTransformer={addTransformer} />
      <TransformerList transformers={transformers} />
    </div>
  );
};

export default TransformerPage;
