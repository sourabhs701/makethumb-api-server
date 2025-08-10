import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const parse = async (req, res) => {
  try {
    const { s3Url } = req.query;

    const TARGET_STRUCTURE = {
      name: "",
      initials: "",
      url: "",
      location: "",
      timezone: "",
      locationLink: "",
      description: "",
      summary: "",
      avatarUrl: "",
      skills: [],
      navbar: [],
      contact: {
        email: "",
        tel: "",
        social: {
          GitHub: {
            name: "",
            url: "",
            icon: "",
            navbar: false,
          },
          LinkedIn: {
            name: "",
            url: "",
            icon: "",
            navbar: false,
          },
          X: {
            name: "",
            url: "",
            icon: "",
            navbar: false,
          },
          email: {
            name: "",
            url: "",
            icon: "",
            navbar: false,
          },
        },
      },
      work: [],
      education: [],
      projects: [],
    };

    const prompt = `
    You are a JSON transformer. Your task is to extract and structure data from a resume provided as text or PDF from an S3 URL.
    Carefully analyze the resume content and convert the information into a valid JSON format.
    Here's the structure you must adhere to.  Return ONLY the JSON, no extra text or explanations.

    The resume is located at the following S3 URL: ${s3Url}
    
    Here's the JSON structure you MUST follow:
    \`\`\`json
    ${JSON.stringify(TARGET_STRUCTURE, null, 2)}
    \`\`\`
    `;

    const { data: pdfBuffer } = await axios.get(s3Url, {
      responseType: "arraybuffer",
    });
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: prompt }] },
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
          ],
        },
      ],
    });

    const responseText = result.response.text();

   let parsedData;
    try {
        const jsonString = responseText.trim().replace(/^```json\s*|^```\s*|\s*```$/g, "");
        parsedData = JSON.parse(jsonString);
    } catch (jsonError) {
        console.error("Error parsing JSON:", jsonError, "Response Text:", responseText);
        return res.status(500).json({ error: "Failed to parse Gemini response as JSON.  Check logs for details." });
    }
    return res.json(parsedData);    
    
  } catch (err) {
    console.error("Error during resume parsing:", err);
    return res
      .status(500)
      .json({ error: "Internal server error during resume parsing" });
  }
};
