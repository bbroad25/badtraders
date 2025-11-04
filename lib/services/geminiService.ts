import { GoogleGenAI } from "@google/genai";
import { LeaderboardEntry } from '@/types/leaderboard';

const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

// Only create client if API key exists
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const generateLoserMeme = async (winner: LeaderboardEntry): Promise<string> => {
    if (!API_KEY || !ai) {
        throw new Error("GEMINI_API_KEY not set. NFT minting requires an API key.");
    }
    const model = 'imagen-4.0-generate-001';
    const prompt = `Create a funny, vibrant, high-quality NFT-style digital art piece commemorating a terrible trading loss.
    The trader "${winner.username || winner.display_name}" (FID: ${winner.fid || 'unknown'}) lost $${winner.loss.toLocaleString()} this week.
    The image should humorously depict a trader in a state of comedic despair, styled as a collectible NFT.
    Incorporate iconic trading meme elements like downward-trending charts (in the background), a sad but proud Wojak or Pepe the frog character in a suit, and maybe some raining red candles.
    The text 'NFT MY LOSSES - $${winner.loss.toLocaleString()}' must be clearly visible and stylishly integrated.
    The style should be modern, electric, eye-catching, and perfect for an NFT - something you'd want to immortalize your failure with forever.
    Add NFT-style elements like a frame, badge, or certificate aesthetic.`;

    try {
        const response = await ai.models.generateImages({
            model,
            prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error('Image generation failed to return an image.');
        }

        const firstImage = response.generatedImages[0];
        if (!firstImage?.image?.imageBytes) {
            throw new Error('Image generation failed to return valid image data.');
        }

        const base64ImageBytes: string = firstImage.image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    } catch (error) {
        console.error("Error in Gemini image generation:", error);
        if (error instanceof Error) {
           throw new Error(`Failed to mint NFT: ${error.message}`);
        }
        throw new Error("An unexpected error occurred during NFT minting.");
    }
};

