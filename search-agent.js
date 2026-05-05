// search-agent.js — agent multi-outils (calculatrice + meteo + web search)

import 'dotenv/config';
import { evaluate } from 'mathjs';
import { runAgent } from './agent-loop.js';

const searchTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Recherche des informations récentes sur le web. Utiliser pour des faits actuels, des événements récents, des prix, des données en temps réel, ou quand on n\'est pas certain d\'une information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La requête de recherche, en anglais pour de meilleurs résultats'
        }
      },
      required: ['query']
    }
  }
};

async function web_search({ query }) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (educational project)' }
  });

  if (!response.ok) {
    return { error: `Erreur DuckDuckGo : ${response.status}` };
  }

  const data = await response.json();

  const topics = (data.RelatedTopics || [])
    .filter(t => t.Text)
    .slice(0, 5)
    .map(t => ({ text: t.Text, url: t.FirstURL }));

  if (topics.length > 0) {
    return { results: topics };
  }

  if (data.AbstractText) {
    return {
      results: [{ text: data.AbstractText, url: data.AbstractURL }]
    };
  }

  return { message: 'Aucun résultat trouvé.' };
}

const weatherTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Récupère la météo actuelle pour une ville donnée.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: "Le nom de la ville, en anglais de préférence (ex: 'Paris', 'Tokyo')"
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
    description: 'Évalue une expression mathématique.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: "L'expression en syntaxe mathjs. Utilise '^' pour les puissances (PAS '**'). Ex: '2^32', 'sqrt(144) + 7*12'"
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

const tools = [calculatorTool, weatherTool, searchTool];
const toolFunctions = { calculate, get_weather, web_search };

const queries = [
  'Qui a gagné la dernière Coupe du monde de football ?',
  'Quelle est la météo à Paris et quel est le cours du Bitcoin aujourd\'hui ?',
  'Cherche-moi des infos sur le langage Rust, puis calcule combien font 17 fois 23.'
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
