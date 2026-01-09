
import { GoogleGenAI } from "@google/genai";
import { AppData, Employee } from "../types";

export const getFinancialSummary = async (data: AppData, employee: Employee) => {
  // Initialize the GoogleGenAI client right before making the call to ensure it uses the current configuration.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const employeeSalaryHistory = data.salaryRecords.filter(r => r.employeeId === employee.id);
  const employeeAdvances = data.advances.filter(a => a.employeeId === employee.id);
  const employeeLoans = data.loans.filter(l => l.employeeId === employee.id);

  const prompt = `
    Analyze the financial status for employee: ${employee.name}.
    Current Base Salary: ${employee.baseSalary}
    Loan Balance: ${employee.loanBalance}
    Bank Type: ${employee.bankType}
    
    Salary History (Last 3 records): ${JSON.stringify(employeeSalaryHistory.slice(-3))}
    Pending Advances: ${JSON.stringify(employeeAdvances.filter(a => !a.isDeducted))}
    Active Loans: ${JSON.stringify(employeeLoans.filter(l => l.remainingAmount > 0))}

    Please provide a concise financial health check, suggesting if the current EMI is sustainable and if any bank charge optimizations are possible.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a professional financial auditor. Provide insights in a professional tone, focused on sustainability and cash flow.",
      }
    });

    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Insights unavailable.";
  }
};
