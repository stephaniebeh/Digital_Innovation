"use client";

import { useState } from "react";

export default function Home() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
  console.log("BUTTON CLICKED"); // 👈 STEP 1 CHECK

  if (!files) {
    console.log("NO FILES SELECTED");
    return;
  }

  setLoading(true);

  const formData = new FormData();

  Array.from(files).forEach((file) => {
    console.log("ADDING FILE:", file.name); // 👈 STEP 2 CHECK
    formData.append("files", file);
  });

  try {
    console.log("SENDING REQUEST..."); // 👈 STEP 3 CHECK

    const response = await fetch("/api/reconstruct", {
      method: "POST",
      body: formData,
    });

    console.log("RESPONSE RECEIVED"); // 👈 STEP 4 CHECK

    const data = await response.json();

    console.log("DATA:", data); // 👈 STEP 5 CHECK

    setResult(data);
  } catch (error) {
    console.log("ERROR OCCURRED:", error); // 👈 STEP 6 CHECK
    setResult({ error: String(error) });
  }

  setLoading(false);
}

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 p-10">
      <h1 className="text-4xl font-bold">
        Afterimage Prototype
      </h1>

      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => setFiles(e.target.files)}
      />

      <button
        onClick={handleUpload}
        className="bg-white text-black px-6 py-3 rounded-xl"
      >
        {loading ? "Uploading..." : "Reconstruct Space"}
      </button>
    </main>
  );
}


