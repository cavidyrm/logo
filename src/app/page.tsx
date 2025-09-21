'use client';

import { useState, ChangeEvent } from 'react';

// --- TypeScript Type Definitions ---
interface ImageInputProps {
  title: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  previewUrl: string;
  id: string;
}

// Type for a part of the Gemini API response
interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

// --- Helper Components ---

const Spinner = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
);

// Reverted to use standard <img> tag to resolve build error
const ImageInput = ({ title, onFileChange, previewUrl, id }: ImageInputProps) => (
  <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col items-center justify-center border-2 border-dashed border-slate-600 h-64 w-full">
    <label htmlFor={id} className="cursor-pointer text-center w-full h-full flex flex-col justify-center items-center">
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      {previewUrl ? (
        <div className="relative w-full h-40">
          <img src={previewUrl} alt={`${title} preview`} className="rounded-md w-full h-full object-contain" />
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="mt-2 text-sm text-slate-400">Click to upload image</span>
        </div>
      )}
    </label>
    <input id={id} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
  </div>
);

// --- Main Page Component ---
export default function LogoPlacerPage() {
  const [productImage, setProductImage] = useState<File | null>(null);
  const [logoImage, setLogoImage] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string>('');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [prompt, setPrompt] = useState<string>(
    "Place the provided logo into the scene with the product. Crucially, place the logo in a free, empty space next to the product on the background, not on the product itself. Analyze the image to find the best location. Consider the composition, lighting, and textures of the background to make the logo look naturally integrated. The logo must be clearly visible and should not cover any part of the main product."
  );
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
        } else {
            reject(new Error('Failed to read file as Base64 string.'));
        }
    };
    reader.onerror = (err) => reject(err);
  });
  
  const handleFileChange = (
    setter: (file: File | null) => void, 
    previewSetter: (url: string) => void
  ) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setter(file);
      previewSetter(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleGenerate = async () => {
    if (!productImage || !logoImage) {
      setError('Please upload both a product image and a logo.');
      return;
    }
    setIsLoading(true);
    setGeneratedImage('');
    setError('');

    try {
      const productBase64 = await fileToBase64(productImage);
      const logoBase64 = await fileToBase64(logoImage);

      const payload = {
        contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: productImage.type, data: productBase64 } },
              { inlineData: { mimeType: logoImage.type, data: logoBase64 } },
            ],
          },
        ],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      };

      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`API Error: ${errorBody.error?.message || response.statusText}`);
      }
      
      const result = await response.json();

      const parts: GeminiPart[] = result?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(p => p.inlineData);
      const base64Data = imagePart?.inlineData?.data;

      if (base64Data) {
        setGeneratedImage(`data:image/png;base64,${base64Data}`);
      } else {
        throw new Error('No image data was returned from the API. The model may not have been able to fulfill the request.');
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans">
      <div className="container mx-auto p-4 sm:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
            AI Logo Placer
          </h1>
          <p className="text-slate-400 mt-2">
            Upload a product image and a logo, then let AI place it perfectly.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-slate-800/30 p-6 rounded-xl shadow-lg flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ImageInput 
                    title="1. Product Image" 
                    onFileChange={handleFileChange(setProductImage, setProductPreview)} 
                    previewUrl={productPreview}
                    id="product-upload"
                />
                <ImageInput 
                    title="2. Logo Image" 
                    onFileChange={handleFileChange(setLogoImage, setLogoPreview)} 
                    previewUrl={logoPreview}
                    id="logo-upload"
                />
            </div>
            
            <div>
              <label htmlFor="prompt" className="block text-lg font-semibold mb-2">3. Instructions</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-32 p-3 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-none"
                placeholder="e.g., Place the logo on the top right corner"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? 'Generating...' : '✨ Generate Image'}
            </button>
            {error && <p className="text-red-400 text-center">{error}</p>}
          </section>

          <section className="bg-slate-800/30 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center min-h-[400px]">
            <h2 className="text-2xl font-semibold mb-4 text-white">Result</h2>
            <div className="w-full h-full flex items-center justify-center bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-600 p-4 min-h-[400px]">
              {isLoading && <Spinner />}
              {!isLoading && !generatedImage && (
                <div className="text-center text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <p className="mt-2">Your generated image will appear here.</p>
                </div>
              )}
              {generatedImage && (
                <div className="relative w-full h-full max-h-[500px]">
                  <img src={generatedImage} alt="Generated result" className="rounded-md max-w-full max-h-full object-contain" />
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

