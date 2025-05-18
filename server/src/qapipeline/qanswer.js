export async function getAnswer(question, context) {
    console.log("[QAPipeline] Getting answer from Azure OpenAI...");

    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2023-05-15";

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const messages = [
        { role: "system", content: "You are a helpful assistant for question answering over documents. Do not make it seem like you are reading from the documents rather that you are answering the question as is using the context." },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }
    ];

    const body = {
        messages,
        max_tokens: 256,
        temperature: 0.2,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[QAPipeline] Azure OpenAI error:", errorText);
        throw new Error("Azure OpenAI API error");
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || "";
    console.log("[QAPipeline] Answer:", answer);
    return answer;
}