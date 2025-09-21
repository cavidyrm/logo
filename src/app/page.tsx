import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image');
    const mask = formData.get('mask');
    const prompt = formData.get('prompt');

    if (!image || !mask || !prompt) {
      return NextResponse.json({ error: 'Missing required fields from client' }, { status: 400 });
    }

    // These are now server-side only, remove NEXT_PUBLIC_ prefix in Vercel
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
        return NextResponse.json({ error: 'Cloudflare credentials are not configured on the server.' }, { status: 500 });
    }

    const proxyFormData = new FormData();
    proxyFormData.append('image', image);
    proxyFormData.append('mask', mask);
    proxyFormData.append('prompt', prompt);

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-inpainting`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}` },
      body: proxyFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Cloudflare API Error:", errorText);
      return NextResponse.json({ error: `Cloudflare API Error: ${response.statusText} - ${errorText}` }, { status: response.status });
    }

    // Stream the image response directly back to the client
    return new NextResponse(response.body, {
        headers: {
            'Content-Type': 'image/png',
        },
    });

  } catch (error) {
    console.error("Internal Server Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred on the server';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}