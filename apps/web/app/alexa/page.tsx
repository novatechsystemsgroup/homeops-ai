import { HomeOpsConsole } from "@/components/HomeOpsConsole";

export default function AlexaPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        A conversational household experience with cards and explicit confirmation. The same capability is exposed to Alexa+ style clients through the
        MCP server (<span className="font-mono">POST /mcp</span>).
      </p>
      <HomeOpsConsole variant="alexa" />
    </div>
  );
}
