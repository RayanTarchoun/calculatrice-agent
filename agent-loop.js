import 'dotenv/config';

export async function runAgent(tools, toolFunctions, userMessage) {
  const messages = [{ role: 'user', content: userMessage }];
  let iterations = 0;

  while (iterations < 10) {
    iterations++;
    const callStart = Date.now();

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        tools,
        tool_choice: 'auto'
      })
    });

    if (!response.ok) {
      throw new Error(`API ${response.status} : ${await response.text()}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    console.log(`[Agent] Tour ${iterations} — ${data.usage?.total_tokens ?? '?'} tokens, ${Date.now() - callStart}ms`);

    messages.push(choice.message);

    if (choice.finish_reason === 'stop') {
      return choice.message.content;
    }

    if (choice.finish_reason === 'tool_calls') {
      for (const toolCall of choice.message.tool_calls) {
        const fn = toolFunctions[toolCall.function.name];
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`   → ${toolCall.function.name}(${JSON.stringify(args)})`);

        const result = fn
          ? await fn(args)
          : { error: `Fonction inconnue : ${toolCall.function.name}` };

        const preview = JSON.stringify(result);
        console.log(`   ← ${preview.slice(0, 120)}${preview.length > 120 ? '...' : ''}`);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }
  }

  throw new Error('Limite de 10 itérations atteinte sans réponse finale.');
}
