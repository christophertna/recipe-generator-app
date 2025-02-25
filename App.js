import React, { useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [ingredients, setIngredients] = useState("");
  const [skillLevel, setSkillLevel] = useState("beginner"); // Default skill level
  const [recipes, setRecipes] = useState([]); // Store multiple recipes
  const [selectedRecipeId, setSelectedRecipeId] = useState(null); // Store the ID of the selected recipe
  const [selectedRecipeDetails, setSelectedRecipeDetails] = useState(null); // Store the selected recipe details
  const [isLoading, setIsLoading] = useState(false);

  // Function to strip HTML tags from the instructions
  const stripHtmlTags = (html) => {
    return html.replace(/<[^>]+>/g, ""); // Remove all HTML tags
  };

  // Function to capitalize the first letter of each word in a string
  const capitalizeTitle = (title) => {
    return title
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const handleInputChange = (e) => {
    setIngredients(e.target.value);
  };

  const handleSkillLevelChange = (e) => {
    setSkillLevel(e.target.value);
  };

  const generateRecipe = async () => {
    setIsLoading(true);
    try {
      // Call the Spoonacular API to find recipes by ingredients
      const response = await axios.get(
        "https://api.spoonacular.com/recipes/findByIngredients",
        {
          params: {
            ingredients: ingredients, // User-provided ingredients
            number: 5, // Fetch up to 5 recipes
            apiKey: "YOUR_API_KEY", // Replace with your Spoonacular API key
          },
        }
      );

      console.log("API Response (findByIngredients):", response.data);

      // Check if recipes were found
      if (response.data.length > 0) {
        // Fetch detailed information for each recipe to get the number of steps and extendedIngredients
        const recipesWithDetails = await Promise.all(
          response.data.map(async (recipe) => {
            const recipeDetails = await axios.get(
              `https://api.spoonacular.com/recipes/${recipe.id}/information`,
              {
                params: {
                  apiKey: "YOUR_API_KEY", // Replace with your Spoonacular API key
                },
              }
            );
            return {
              ...recipe,
              steps: recipeDetails.data.instructions
                ? recipeDetails.data.instructions.split(".").filter((step) => step.trim()).length
                : 0, // Count the number of steps
              extendedIngredients: recipeDetails.data.extendedIngredients || [], // Include extendedIngredients
            };
          })
        );

        // Sort recipes based on the most ingredients in common and least steps
        const sortedRecipes = sortRecipes(recipesWithDetails);

        // Filter out recipes with 0 matching ingredients or more than 15 missing ingredients
        const filteredRecipes = sortedRecipes.filter((recipe) => {
          const { missingCount, matchingCount } = getIngredientsComparison(recipe);
          return matchingCount > 0 && missingCount <= 15; // Only include recipes with at least 1 matching ingredient and <= 15 missing ingredients
        });

        setRecipes(filteredRecipes); // Store filtered recipes
        setSelectedRecipeId(null); // Reset the selected recipe
        setSelectedRecipeDetails(null); // Reset the selected recipe details
      } else {
        setRecipes([]); // Clear the recipes list
        setSelectedRecipeDetails("No recipes found. Please try different ingredients.");
      }
    } catch (error) {
      console.error("Error generating recipe:", error.response ? error.response.data : error.message);
      setSelectedRecipeDetails("Failed to generate a recipe. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const sortRecipes = (recipes) => {
    return recipes.sort((a, b) => {
      // Sort by most ingredients in common (least missing ingredients)
      const missingIngredientsA = a.missedIngredientCount;
      const missingIngredientsB = b.missedIngredientCount;

      if (missingIngredientsA !== missingIngredientsB) {
        return missingIngredientsA - missingIngredientsB;
      }

      // If missing ingredients are the same, sort by least steps
      return a.steps - b.steps;
    });
  };

  const fetchRecipeDetails = async (recipeId) => {
    try {
      // Fetch detailed recipe information
      const recipeDetails = await axios.get(
        `https://api.spoonacular.com/recipes/${recipeId}/information`,
        {
          params: {
            apiKey: "YOUR_API_KEY", // Replace with your Spoonacular API key
          },
        }
      );

      console.log("API Response (recipeDetails):", recipeDetails.data);

      // Check if the recipe details are valid
      if (!recipeDetails.data) {
        throw new Error("No recipe details found.");
      }

      // Format the instructions
      const instructions = stripHtmlTags(recipeDetails.data.instructions || "No instructions available.");
      const formattedInstructions = formatInstructions(instructions);

      // Get missing and matching ingredients
      const { missingIngredients, matchingIngredients } = getIngredientsComparison(recipeDetails.data);

      // Display the recipe title, missing ingredients, matching ingredients, and formatted instructions
      setSelectedRecipeDetails({
        title: capitalizeTitle(recipeDetails.data.title), // Capitalize the title
        steps: recipeDetails.data.instructions
          ? recipeDetails.data.instructions.split(".").filter((step) => step.trim()).length
          : 0, // Include steps in the details
        missingIngredients,
        matchingIngredients,
        instructions: formattedInstructions,
      });

      // Set the selected recipe ID
      setSelectedRecipeId(recipeId);
    } catch (error) {
      console.error("Error fetching recipe details:", error.response ? error.response.data : error.message);
      setSelectedRecipeDetails({
        title: "Error",
        steps: 0,
        missingIngredients: "N/A",
        matchingIngredients: "N/A",
        instructions: "Failed to fetch recipe details. Please try again.",
      });
    }
  };

  const getIngredientsComparison = (recipeDetails) => {
    // Get the list of ingredients from the recipe
    const recipeIngredients = recipeDetails.extendedIngredients
      ? recipeDetails.extendedIngredients.map((ingredient) => ingredient.name.toLowerCase())
      : [];

    // Get the list of ingredients from the user input
    const userIngredients = ingredients
      .toLowerCase()
      .split(",")
      .map((ingredient) => ingredient.trim());

    // Find ingredients in the recipe that are not in the user's input (missing ingredients)
    const missingIngredients = recipeIngredients.filter(
      (ingredient) => !userIngredients.includes(ingredient) && ingredient !== "water" // Exclude water
    );

    // Find ingredients in the recipe that are in the user's input (matching ingredients)
    const matchingIngredients = recipeIngredients.filter((ingredient) =>
      userIngredients.includes(ingredient)
    );

    // Return the missing and matching ingredients as counts and lists
    return {
      missingIngredients:
        missingIngredients.length > 0 ? missingIngredients.join(", ") : "No missing ingredients found.",
      matchingIngredients:
        matchingIngredients.length > 0 ? matchingIngredients.join(", ") : "No matching ingredients found.",
      missingCount: missingIngredients.length,
      matchingCount: matchingIngredients.length,
    };
  };

  const formatInstructions = (instructions) => {
    // Split instructions into steps based on periods, semicolons, or lowercase letters followed by capital letters
    let steps = instructions.split(/(?<=\.)\s+(?=[A-Z])|(?<=;)\s+(?=[A-Z])|(?<=[a-z])(?=[A-Z])/g);

    // Secondary check: If a step contains a period followed by a capital letter, split it further
    steps = steps.flatMap((step) => {
      const subSteps = step.split(/(?<=\.)\s+(?=[A-Z])/g);
      return subSteps.map((subStep) => subStep.trim());
    });

    // Enumerate steps and add line breaks
    return steps
      .map((step, index) => {
        // Remove leading/trailing whitespace and ensure the step starts with a capital letter
        const trimmedStep = step.trim();
        return `${index + 1}. ${trimmedStep.charAt(0).toUpperCase() + trimmedStep.slice(1)}`;
      })
      .join("<br /><br />"); // Add double line breaks between steps
  };

  return (
    <div className="App">
      <h1>🍴 Leftover Recipe Generator 🍴</h1>
      <div className="input-container">
        <textarea
          placeholder="Enter your leftover ingredients (e.g., chicken, rice, tomatoes)..."
          value={ingredients}
          onChange={handleInputChange}
          rows="5"
        />
        <div className="skill-level-container">
          <label htmlFor="skill-level">Cooking Skill Level:</label>
          <select id="skill-level" value={skillLevel} onChange={handleSkillLevelChange}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
        </div>
        <button onClick={generateRecipe} disabled={isLoading}>
          {isLoading ? "Generating..." : "Generate Recipe"}
        </button>
      </div>

      {/* Display the list of recipes */}
      {recipes.length > 0 && (
        <div className="recipe-list">
          <h2>Recipes:</h2>
          <ul>
            {recipes.map((recipe) => {
              // Get matching and missing ingredients for the recipe card
              const { missingCount, matchingCount } = getIngredientsComparison(recipe);

              return (
                <li key={recipe.id}>
                  <div className="recipe-card" onClick={() => fetchRecipeDetails(recipe.id)}>
                    <h3>
                      {capitalizeTitle(recipe.title)}{" "}
                      <span style={{ color: "black" }}>(Steps: {recipe.steps})</span>
                    </h3>
                    <p style={{ color: "black" }}>
                      Uses <span className="matching-count">{matchingCount}</span> ingredients that you have.{" "}
                      <span className="missing-count">(Missing: {missingCount})</span>
                    </p>
                  </div>
                  {/* Display recipe details if this recipe is selected */}
                  {selectedRecipeId === recipe.id && selectedRecipeDetails && (
                    <div className="recipe-details">
                      <div className="recipe-header">
                        <h2 className="recipe-title">
                          {selectedRecipeDetails.title}{" "}
                          <span style={{ color: "black" }}>(Steps: {selectedRecipeDetails.steps})</span>
                        </h2>
                        <div className="ingredients-section">
                          <div className="missing-ingredients">
                            <strong>Missing:</strong>{" "}
                            <span className="missing-list">{selectedRecipeDetails.missingIngredients}</span>
                          </div>
                          <br /> {/* Add a line break after missing ingredients */}
                          <div className="matching-ingredients">
                            <strong>Have:</strong>{" "}
                            <span className="matching-list">{selectedRecipeDetails.matchingIngredients}</span>
                          </div>
                        </div>
                      </div>
                      <div
                        className="recipe-instructions"
                        dangerouslySetInnerHTML={{ __html: selectedRecipeDetails.instructions }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Display error or no recipes found message */}
      {selectedRecipeDetails && typeof selectedRecipeDetails === "string" && (
        <div className="recipe-details">
          <p>{selectedRecipeDetails}</p>
        </div>
      )}
    </div>
  );
}

export default App;
