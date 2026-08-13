import type {
  CalendarCriterion,
  CalendarSearchField,
  CalendarSearchSuggestion,
} from "../lib/calendarSearch";
import { CALENDAR_SEARCH_FIELDS } from "../lib/calendarSearch";

type Props = {
  field: CalendarSearchField;
  draft: string;
  results: CalendarSearchSuggestion[];
  searched: boolean;
  criteria: CalendarCriterion[];
  shown: boolean;
  labels: {
    search: string;
    searchBy: string;
    query: string;
    placeholder: string;
    add: string;
    result: string;
    criteria: string;
    noResult: string;
    searchFirst: string;
    clearCriteria: string;
    show: string;
    fieldLabel: (field: CalendarSearchField) => string;
  };
  onFieldChange: (field: CalendarSearchField) => void;
  onDraftChange: (value: string) => void;
  onSearch: () => void;
  onClearDraft: () => void;
  onAddResult: (item: CalendarSearchSuggestion) => void;
  onRemoveCriterion: (id: string) => void;
  onClearCriteria: () => void;
  onShow: () => void;
};

export function CalendarSearchBar({
  field,
  draft,
  results,
  searched,
  criteria,
  shown,
  labels,
  onFieldChange,
  onDraftChange,
  onSearch,
  onClearDraft,
  onAddResult,
  onRemoveCriterion,
  onClearCriteria,
  onShow,
}: Props) {
  const canShow = criteria.length > 0;

  return (
    <div className="cal-std-search">
      <div className="cal-std-search-panel">
        <h3 className="cal-std-heading">{labels.search}</h3>
        <div className="cal-std-search-row">
          <select
            className="cal-std-param"
            aria-label={labels.searchBy}
            value={field}
            onChange={(e) =>
              onFieldChange(e.target.value as CalendarSearchField)
            }
          >
            {CALENDAR_SEARCH_FIELDS.map((key) => (
              <option key={key} value={key}>
                {labels.fieldLabel(key)}
              </option>
            ))}
          </select>
          <div className="cal-std-input-wrap">
            <input
              value={draft}
              placeholder={labels.placeholder}
              aria-label={labels.query}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSearch();
                }
              }}
            />
            {draft ? (
              <button
                type="button"
                className="cal-std-clear-x"
                aria-label={labels.clearCriteria}
                onClick={onClearDraft}
              >
                ×
              </button>
            ) : null}
          </div>
          <button type="button" className="btn btn-sm cal-std-go" onClick={onSearch}>
            {labels.search}
          </button>
        </div>
      </div>

      <div className="cal-std-split">
        <div className="cal-std-result-panel">
          <h3 className="cal-std-heading">{labels.result}</h3>
          {!searched ? (
            <div className="empty-note cal-std-empty">{labels.searchFirst}</div>
          ) : results.length === 0 ? (
            <div className="empty-note cal-std-empty">{labels.noResult}</div>
          ) : (
            <div className="cal-std-result-list" role="listbox">
              {results.map((item, index) => {
                const alreadyIn = criteria.some(
                  (c) =>
                    (item.field ?? field) === c.field &&
                    c.value.trim().toLowerCase() ===
                      item.value.trim().toLowerCase(),
                );
                return (
                  <button
                    key={`${item.value}-${index}`}
                    type="button"
                    className={`cal-std-result-row${index % 2 ? " alt" : ""}${alreadyIn ? " picked" : ""}`}
                    onClick={() => onAddResult(item)}
                    title={labels.add}
                    disabled={alreadyIn}
                  >
                    <span className="cal-std-result-label">{item.label}</span>
                    {item.sub && item.sub !== item.label ? (
                      <span className="cal-std-result-code">{item.sub}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="cal-std-criteria-panel">
          <div className="cal-std-criteria-head">
            <h3 className="cal-std-heading">{labels.criteria}</h3>
            {criteria.length > 0 ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onClearCriteria}
              >
                {labels.clearCriteria}
              </button>
            ) : null}
          </div>
          {criteria.length === 0 ? (
            <p className="cal-std-criteria-empty">{labels.add}</p>
          ) : (
            <div className="cal-std-criteria-list">
              {criteria.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="cal-std-criterion"
                  onClick={() => onRemoveCriterion(c.id)}
                  title={labels.clearCriteria}
                >
                  <span>
                    <strong>{labels.fieldLabel(c.field)}</strong>: {c.label}
                  </span>
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn btn-sm cal-std-show"
            onClick={onShow}
            disabled={!canShow}
          >
            {labels.show}
            {shown && canShow ? " ✓" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
