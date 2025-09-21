'use client';

import { useState, ChangeEvent, useRef, useEffect } from 'react';

// NOTE: The '@imgly/background-removal' library has been completely removed to fix the errors.

// --- TypeScript Type Definitions ---
interface ImageInputProps {
  title: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  id: string;
  note?: string;
}

// --- Helper Components ---
const Spinner = ({ text }: { text: string }) => (
    <div className="flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        <span className="mt-3 text-slate-400">{text}</span>
    </div>
);

const ImageInput = ({ title, onFileChange, id, note }: ImageInputProps) => (
  <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col items-center justify-center border-2 border-dashed border-slate-600 h-52 w-full">
    <label htmlFor={id} className="cursor-pointer text-center w-full h-full flex flex-col justify-center items-center">
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <div className="flex flex-col items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="mt-2 text-sm text-slate-400">Click to upload</span>
        {note && <span className="mt-1 text-xs text-slate-500">{note}</span>}
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
    "A photorealistic image. The provided logo is on a solid background; make this background completely transparent before integrating the logo. Place the now-transparent logo naturally into the scene's background. Match the lighting, texture, and perspective. Add a subtle, realistic shadow. The main product must remain untouched. The logo's design must be perfectly preserved."
  );
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [logoSize, setLogoSize] = useState(15);
  const [logoPosition, setLogoPosition] = useState({ x: 75, y: 80 });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileChange = (
    imageSetter: (img: HTMLImageElement | null) => void
  ) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          imageSetter(img);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !productImage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = productImage.width;
    canvas.height = productImage.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(productImage, 0, 0);

    if (logoImage) {
      const logoWidth = canvas.width * (logoSize / 100);
      const logoHeight = logoImage.height * (logoWidth / logoImage.width);
      const x = canvas.width * (logoPosition.x / 100) - logoWidth / 2;
      const y = canvas.height * (logoPosition.y / 100) - logoHeight / 2;
      ctx.drawImage(logoImage, x, y, logoWidth, logoHeight);
    }
  }, [productImage, logoImage, logoSize, logoPosition]);

  const getCanvasBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas to Blob conversion failed"));
        }
      }, 'image/png');
    });
  };

  const handleGenerate = async () => {
    if (!productImage || !logoImage) {
      setError('Please upload images and wait for processing.');
      return;
    }
    setIsLoading(true);
    setGeneratedImage('');
    setError('');

    try {
      // Create a canvas for the product image to reliably get a blob
      const imageCanvas = document.createElement('canvas');
      imageCanvas.width = productImage.width;
      imageCanvas.height = productImage.height;
      const imageCtx = imageCanvas.getContext('2d');
      if (!imageCtx) throw new Error("Could not create image canvas context.");
      imageCtx.drawImage(productImage, 0, 0);

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = productImage.width;
      maskCanvas.height = productImage.height;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) throw new Error("Could not create mask canvas context.");

      maskCtx.fillStyle = '#000000';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      const logoWidth = maskCanvas.width * (logoSize / 100);
      const logoHeight = logoImage.height * (logoWidth / logoImage.width);
      const logoX = maskCanvas.width * (logoPosition.x / 100) - logoWidth / 2;
      const logoY = maskCanvas.height * (logoPosition.y / 100) - logoHeight / 2;
      
      maskCtx.fillStyle = '#FFFFFF';
      maskCtx.fillRect(logoX, logoY, logoWidth, logoHeight);

      const [imageBlob, maskBlob] = await Promise.all([
        getCanvasBlob(imageCanvas), // Use canvas method instead of fetch
        getCanvasBlob(maskCanvas)
      ]);
      
      const accountId = process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.NEXT_PUBLIC_CLOUDFLARE_API_TOKEN;

      if (!accountId || !apiToken) throw new Error("Cloudflare credentials are not configured.");

      const formData = new FormData();
      formData.append('image', imageBlob);
      formData.append('mask', maskBlob);
      formData.append('prompt', prompt);
      
      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-inpainting`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}` },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.statusText} - ${errorText}`);
      }
      
      const resultBlob = await response.blob();
      setGeneratedImage(URL.createObjectURL(resultBlob));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans">
      <div className="container mx-auto p-4 sm:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">AI Logo Placer</h1>
          <p className="text-slate-400 mt-2">Powered by Cloudflare AI</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-slate-800/30 p-6 rounded-xl shadow-lg flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageInput title="1. Product Image" onFileChange={handleFileChange(setProductImage)} id="product-upload"/>
              <ImageInput title="2. Logo Image" onFileChange={handleFileChange(setLogoImage)} id="logo-upload" note="Transparent PNGs work best!"/>
            </div>
            
            {productImage && logoImage && (
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-3">3. Adjust Logo</h3>
                 <div className="space-y-4">
                  <div>
                      <label className="block text-sm mb-1">Size ({logoSize}%)</label>
                      <input type="range" min="1" max="100" value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                  <div>
                      <label className="block text-sm mb-1">Horizontal Position ({logoPosition.x}%)</label>
                      <input type="range" min="0" max="100" value={logoPosition.x} onChange={(e) => setLogoPosition(p => ({ ...p, x: Number(e.target.value) }))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                  <div>
                      <label className="block text-sm mb-1">Vertical Position ({logoPosition.y}%)</label>
                      <input type="range" min="0" max="100" value={logoPosition.y} onChange={(e) => setLogoPosition(p => ({ ...p, y: Number(e.target.value) }))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <label htmlFor="prompt" className="block text-lg font-semibold mb-2">4. Instructions for AI</label>
              <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full h-24 p-3 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 transition"/>
            </div>

            <button onClick={handleGenerate} disabled={isLoading || !productImage || !logoImage} className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center h-12">
              {isLoading ? <Spinner text="Integrating Image..." /> : '✨ Generate Final Image'}
            </button>
            {error && <p className="text-red-400 text-center">{error}</p>}
          </section>

          <section className="bg-slate-800/30 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center min-h-[500px]">
            <h2 className="text-2xl font-semibold mb-4 text-white">Live Preview & Result</h2>
            <div className="w-full h-full flex items-center justify-center bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-600 p-2 aspect-w-1 aspect-h-1">
                {isLoading && <Spinner text="AI is thinking..." />}
                {generatedImage && <img src={generatedImage} alt="Generated result" className="max-w-full max-h-full object-contain rounded-md"/>}
                {!isLoading && !generatedImage && (
                    <div className="relative w-full h-full flex items-center justify-center">
                        {!productImage && <p className="text-slate-500 text-center">Upload images to begin</p>}
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