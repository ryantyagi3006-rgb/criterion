// Registry of subject-specific tools that can be assigned to questions.
export const TOOLS: Record<string, { label: string; short: string }> = {
  calculator: { label: "Scientific Calculator", short: "Calc" },
  graphing: { label: "Graph Plotter", short: "Graph" },
  formula_sheet: { label: "Formula Sheet", short: "Formulae" },
  periodic_table: { label: "Periodic Table", short: "Elements" },
  unit_converter: { label: "Unit Converter", short: "Units" },
  code_editor: { label: "Code Console", short: "Code" },
  spreadsheet: { label: "Data Table", short: "Data" },
  dictionary: { label: "Word Tools", short: "Words" },
  map: { label: "Coordinate Grid", short: "Grid" },
};

export const TOOL_IDS = Object.keys(TOOLS);
