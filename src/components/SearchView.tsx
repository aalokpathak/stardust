import { Search24Regular } from "@fluentui/react-icons";
import { useEffect } from "react";
import { api } from "../lib/api";
import { plural } from "../lib/format";
import { setResults, showError, useStore } from "../lib/store";
import { NoteCard } from "./NoteCard";
import { EmptyState, PageHeader } from "./ui";

const SEARCH_DELAY = 60;

export function SearchView() {
  const query = useStore((state) => state.query);
  const results = useStore((state) => state.results);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    let current = true;
    const timer = setTimeout(() => {
      api
        .searchNotes(trimmed)
        .then((notes) => {
          if (current) setResults(notes);
        })
        .catch(showError);
    }, SEARCH_DELAY);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[980px] px-8 pt-8 pb-10">
        <PageHeader eyebrow="Search" title={`"${query.trim()}"`} subtitle={plural(results.length, "note")} />
        <div className="mt-6">
          {results.length === 0 ? (
            <EmptyState
              icon={<Search24Regular />}
              title="No matches"
              body="Stardust looks through every title and note. Try fewer or different words."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
