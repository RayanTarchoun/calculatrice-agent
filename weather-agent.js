import 'dotenv/config';
import { evaluate } from 'mathjs';
import { runAgent } from './agent-loop.js';

const weatherTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Récupère la météo actuelle pour une ville donnée. Utiliser quand on parle de météo, température, conditions climatiques.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: "Le nom de la ville, en anglais de préférence (ex: 'Paris', 'London', 'Tokyo')"
        }
      },
      required: ['city']
    }
  }
};

async function get_weather({ city }) {
  const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
  if (!response.ok) {
    return { error: `Impossible de récupérer la météo pour ${city}` };
  }
  const data = await response.json();
  const current = data.current_condition[0];
  return {
    city,
    temperature_c: current.temp_C,
    feels_like_c: current.FeelsLikeC,
    description: current.weatherDesc[0].value,
    humidity: current.humidity + '%',
    wind_kmph: current.windspeedKmph
  };
}

const calculatorTool = {
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
};

function calculate({ expression }) {
  try {
    return { result: String(evaluate(expression)) };
  } catch (e) {
    return { error: `Expression invalide : ${e.message}` };
  }
}

const tools = [weatherTool, calculatorTool];
const toolFunctions = { get_weather, calculate };

const queries = [
  'Quelle est la météo à Paris et à Tokyo en ce moment ?',
  'Il fait combien à Lyon ? Est-ce qu\'il faut un manteau ?',
  'Compare la température de Paris et de Marseille, et calcule la différence en degrés.'
];

for (const query of queries) {
  console.log('\n' + '='.repeat(70));
  console.log(`👤 ${query}`);
  console.log('='.repeat(70));
  try {
    const reply = await runAgent(tools, toolFunctions, query);
    console.log(`\n🤖 ${reply}\n`);
  } catch (e) {
    console.error(`❌ ${e.message}\n`);
  }
}
