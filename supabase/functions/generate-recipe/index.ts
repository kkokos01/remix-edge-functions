<script>
document.addEventListener('DOMContentLoaded', function() {
  // Project configuration
  const SUPABASE_PROJECT_ID = 'tehwjzcwlejiuntymwal';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaHdqemN3bGVqaXVudHltd2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY0NjMzMDAsImV4cCI6MjA1MjAzOTMwMH0.TDGkirSHadkUjImAr2dRKHcsiscZQqWoHJp6b3B31ko';

  // State and DOM elements
  let currentRecipeData = null;
  const topForm = document.getElementById('generate-recipe-form');
  const recipeContent = document.querySelector('.recipe-content');
  const bottomPrompt = document.querySelector('.bottom-prompt');
  const createBtn = document.querySelector('.create-button');
  const modifyBtn = document.querySelector('.modify-button');

  // Display helper
  function displayJSONOrMessage(dataOrMsg) {
    if (!recipeContent) return;
    if (typeof dataOrMsg === 'string') {
      recipeContent.textContent = dataOrMsg;
    } else {
      recipeContent.textContent = JSON.stringify(dataOrMsg, null, 2);
    }
  }

  // API call helper
  async function callEdgeFunction(functionName, payload) {
    try {
      const response = await fetch(
        `https://${SUPABASE_PROJECT_ID}.functions.supabase.co/${functionName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error(`Error calling ${functionName}:`, error);
      throw error;
    }
  }

  // Handle recipe generation (top form)
  if (topForm) {
    topForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      displayJSONOrMessage('Generating recipe...');

      try {
        const userPromptTextarea = topForm.querySelector('textarea');
        const prompt = userPromptTextarea ? userPromptTextarea.value.trim() : '';
        
        if (!prompt) {
          throw new Error('Please enter a recipe request');
        }

        const data = await callEdgeFunction('generate-recipe', { prompt });
        currentRecipeData = data;
        displayJSONOrMessage(data);
      } catch (error) {
        displayJSONOrMessage(`Error: ${error.message}`);
      }
    });
  }

  // Handle recipe generation (bottom bar)
  if (createBtn && bottomPrompt) {
    createBtn.addEventListener('click', async function() {
      displayJSONOrMessage('Generating recipe...');

      try {
        const prompt = bottomPrompt.value.trim();
        if (!prompt) {
          throw new Error('Please enter a recipe request');
        }

        const data = await callEdgeFunction('generate-recipe', { prompt });
        currentRecipeData = data;
        displayJSONOrMessage(data);
      } catch (error) {
        displayJSONOrMessage(`Error: ${error.message}`);
      }
    });
  }

  // Handle recipe modification
  if (modifyBtn && bottomPrompt) {
    modifyBtn.addEventListener('click', async function() {
      if (!currentRecipeData) {
        displayJSONOrMessage('Please generate a recipe first before modifying.');
        return;
      }

      displayJSONOrMessage('Modifying recipe...');

      try {
        const modifyPrompt = bottomPrompt.value.trim() || 'Surprise me with a fun twist!';
        const data = await callEdgeFunction('modify-recipe', {
          priorRecipe: currentRecipeData,
          modifyPrompt: modifyPrompt
        });

        currentRecipeData = data;
        displayJSONOrMessage(data);
      } catch (error) {
        displayJSONOrMessage(`Error: ${error.message}`);
      }
    });
  }
});
</script>
