import 'dotenv/config';
import { evaluate } from 'mathjs';

const tools = [
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Évalue une expression mathématique et retourne le résultat.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: "L'expression à évaluer, ex: '(15 * 4) / 3' ou '2 ** 32'"
          }
        },
        required: ['expression']
      }
    }
  }
];

// mathjs au lieu d'eval() : pas d'injection possible
function calculate(expression) {
  try {
    return { result: String(evaluate(expression)) };
  } catch (e) {
    return { error: `Expression invalide : ${e.message}` };
  }
}

const availableTools = {
  calculate: (args) => calculate(args.expression)
};

async function callMistral(messages) {
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
  return response.json();
}

async function callWithTools(userMessage) {
  const messages = [
    { role: 'user', content: userMessage }
  ];

  const MAX_ITERATIONS = 5;

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    console.log(`\n--- Itération ${i} ---`);

    const data = await callMistral(messages);
    const message = data.choices[0].message;

    // Pas d'outil demandé → réponse finale
    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.log('\n✅ Réponse finale :\n' + message.content);
      return message.content;
    }

    console.log(`🔧 ${message.tool_calls.length} appel(s) d'outil demandé(s)`);

    // Le message assistant doit être poussé AVANT les réponses tool,
    // sinon les tool_call_id n'ont rien à référencer.
    messages.push(message);

    for (const toolCall of message.tool_calls) {
      const fnName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      console.log(`   → ${fnName}(${JSON.stringify(args)})`);

      const fn = availableTools[fnName];
      const result = fn ? fn(args) : { error: `Fonction inconnue : ${fnName}` };

      console.log(`   ← ${JSON.stringify(result)}`);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: fnName,
        content: JSON.stringify(result)
      });
    }
  }

  console.log('⚠️  Limite d\'itérations atteinte sans réponse finale.');
}

callWithTools('Combien fait 2 à la puissance 32 ? Et 15 fois 24 ?')
  .catch(e => console.error('❌ Erreur :', e.message));
