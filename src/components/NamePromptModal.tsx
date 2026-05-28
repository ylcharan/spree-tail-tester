import { useState } from "react";
import { Modal } from "./Modal";
import { useApp } from "../contexts/AppContext";

export function NamePromptModal() {
  const { showNameModal, setCurrentUserName } = useApp();
  const [name, setName] = useState("");

  return (
    <Modal title="Welcome" open={showNameModal} onClose={() => {}}>
      <p className="mb-4 text-sm text-slate-600">
        Enter your name to get started. We&apos;ll remember it on this device.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setCurrentUserName(name);
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Your name</span>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            placeholder="e.g. John Doe"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700"
        >
          Continue
        </button>
      </form>
    </Modal>
  );
}
