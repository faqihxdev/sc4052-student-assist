import { MessageCircle, Send } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-full bg-indigo-100 p-4">
          <MessageCircle className="h-8 w-8 text-indigo-600" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          Welcome to StudentAssist
        </h2>
        <p className="mb-6 max-w-md text-gray-500">
          Your personal AI assistant for managing classes, tasks, GitHub
          projects, news, and weather. Try asking something like:
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "What's my day looking like?",
            "Show my pending tasks",
            "Summarize my GitHub activity",
            "What's trending in tech?",
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <input
            type="text"
            placeholder="Ask StudentAssist anything..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            disabled
          />
          <button
            className="rounded-lg bg-indigo-600 p-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            disabled
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">
          Chat functionality coming in Phase 4
        </p>
      </div>
    </div>
  );
}
