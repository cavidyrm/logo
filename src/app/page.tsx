'use client';

import { useState, ChangeEvent, useRef, useEffect } from 'react';

// --- TypeScript Type Definitions ---
interface ImageInputProps {
  title: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  id: string;
}

interface StabilityArtifact {
  base64: string;
  finishReason: string;
  seed: number;
}

// --- Helper Components ---

const Spinner = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
);

const ImageInput = ({ title, onFileChange, id }: ImageInputProps) => (
  <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col items-center justify-center border-2 border-dashed border-slate-600 h-48 w-full">
    <label htmlFor={id} className="cursor-pointer text-center w-full h-full flex flex-col justify-center items-center">
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <div className="flex flex-col items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="mt-2 text-sm text-slate-400">Click to upload</span>
      </div>
    </label>
    <input id={id} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
  </div>
);

// --- Main Page Component ---
export default function LogoPlacerPage() {
  const [productImage, setProductImage] = useState<HTMLImageElement | null>(null);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [prompt, setPrompt] = useState<string>(
    "Blend the added logo seamlessly into the background. Match the lighting, texture, and perspective of the scene. Add a subtle, realistic shadow if appropriate. The main product should remain untouched and in focus."
  );
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // State for logo controls
  const [logoSize, setLogoSize] = useState(15); // Percentage of canvas width
  const [logoPosition, setLogoPosition] = useState({ x: 75, y: 80 }); // Percentage position

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileChange = (
    imageSetter: (img: HTMLImageElement | null) => void
  ) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => imageSetter(img);
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  // Effect to draw on the canvas whenever an image or control changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !productImage) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match product image for high quality
    canvas.width = productImage.width;
    canvas.height = productImage.height;

    // Draw product image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(productImage, 0, 0);

    // Draw logo image if it exists
    if (logoImage) {
      const logoWidth = canvas.width * (logoSize / 100);
      const logoHeight = logoImage.height * (logoWidth / logoImage.width);
      const x = canvas.width * (logoPosition.x / 100) - logoWidth / 2;
      const y = canvas.height * (logoPosition.y / 100) - logoHeight / 2;
      ctx.drawImage(logoImage, x, y, logoWidth, logoHeight);
    }
  }, [productImage, logoImage, logoSize, logoPosition]);

  const handleGenerate = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !productImage || !logoImage) {
      setError('Please upload both a product image and a logo.');
      return;
    }
    setIsLoading(true);
    setGeneratedImage('');
    setError('');

    // Convert canvas content to a Blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError('Could not process the combined image.');
        setIsLoading(false);
        return;
      }

      try {
        const apiKey = process.env.NEXT_PUBLIC_STABILITY_API_KEY;
        if (!apiKey) {
          throw new Error("Stability AI API key is not configured. Please set NEXT_PUBLIC_STABILITY_API_KEY in Vercel and redeploy.");
        }

        const formData = new FormData();
        formData.append('init_image', blob); // The combined image from the canvas
        formData.append('text_prompts[0][text]', prompt);
        formData.append('init_image_mode', "IMAGE_STRENGTH");
        formData.append('image_strength', "0.4"); // Lower strength to preserve more of the original
        formData.append('cfg_scale', '7');
        formData.append('samples', '1');
        formData.append('steps', '30');

        const engineId = 'stable-diffusion-xl-1024-v1-0';
        const apiUrl = `https://api.stability.ai/v1/generation/${engineId}/image-to-image`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.statusText} - ${errorText}`);
        }
        
        const result: { artifacts: StabilityArtifact[] } = await response.json();
        const imageArtifact = result.artifacts?.[0];

        if (imageArtifact && imageArtifact.finishReason === "SUCCESS") {
          setGeneratedImage(`data:image/png;base64,${imageArtifact.base64}`);
        } else {
          throw new Error('Image generation failed. The API did not return a successful image.');
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
    }, 'image/png');
  };

  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans">
      <div className="container mx-auto p-4 sm:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">AI Logo Placer</h1>
          <p className="text-slate-400 mt-2">Powered by Stability AI</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT COLUMN - CONTROLS */}
          <section className="bg-slate-800/30 p-6 rounded-xl shadow-lg flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageInput title="1. Product Image" onFileChange={handleFileChange(setProductImage)} id="product-upload"/>
              <ImageInput title="2. Logo Image" onFileChange={handleFileChange(setLogoImage)} id="logo-upload"/>
            </div>
            
            {productImage && logoImage && (
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-3">3. Adjust Logo</h3>
                <div className="space-y-4">
                  <div>
                      <label htmlFor="size" className="block text-sm mb-1">Size ({logoSize}%)</label>
                      <input type="range" id="size" min="1" max="100" value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                  <div>
                      <label htmlFor="x-pos" className="block text-sm mb-1">Horizontal Position ({logoPosition.x}%)</label>
                      <input type="range" id="x-pos" min="0" max="100" value={logoPosition.x} onChange={(e) => setLogoPosition(p => ({ ...p, x: Number(e.target.value) }))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                  <div>
                      <label htmlFor="y-pos" className="block text-sm mb-1">Vertical Position ({logoPosition.y}%)</label>
                      <input type="range" id="y-pos" min="0" max="100" value={logoPosition.y} onChange={(e) => setLogoPosition(p => ({ ...p, y: Number(e.target.value) }))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <label htmlFor="prompt" className="block text-lg font-semibold mb-2">4. Instructions for AI</label>
              <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full h-24 p-3 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 transition"/>
            </div>

            <button onClick={handleGenerate} disabled={isLoading || !productImage || !logoImage} className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
              {isLoading ? 'Integrating...' : '✨ Generate Final Image'}
            </button>
            {error && <p className="text-red-400 text-center">{error}</p>}
          </section>

          {/* RIGHT COLUMN - PREVIEW & RESULT */}
          <section className="bg-slate-800/30 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center min-h-[500px]">
            <h2 className="text-2xl font-semibold mb-4 text-white">Live Preview & Result</h2>
            <div className="w-full h-full flex items-center justify-center bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-600 p-2 aspect-w-1 aspect-h-1">
                {isLoading && <Spinner/>}
                {!isLoading && generatedImage && <img src={generatedImage} alt="Generated result" className="max-w-full max-h-full object-contain rounded-md"/>}
                {!isLoading && !generatedImage && (
                    <div className="relative w-full h-full">
                        {!productImage && <p className="text-slate-500 text-center self-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">Upload images to begin</p>}
                        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded-md" style={{ display: productImage ? 'block' : 'none' }}/>
                    </div>
                )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}