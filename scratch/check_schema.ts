import { supabase } from "./src/integrations/supabase/client";

async function checkSchema() {
  const { data, error } = await supabase.from("incomes").select("*").limit(1);
  if (error) {
    console.error("Error fetching incomes:", error);
    return;
  }
  if (data && data.length > 0) {
    console.log("Income columns:", Object.keys(data[0]));
  } else {
    console.log("No incomes found to check schema.");
  }
}

checkSchema();
