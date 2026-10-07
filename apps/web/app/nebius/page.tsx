import { HomeOpsConsole } from "@/components/HomeOpsConsole";

export default function NebiusPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        The same agent with the infrastructure made visible: which provider planned the response, how long it took, which actions were taken and where
        the sources came from.
      </p>
      <HomeOpsConsole variant="nebius" />
    </div>
  );
}
