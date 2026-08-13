import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { ActivitiesPage } from "./ActivitiesPage";
import { ModulesPage } from "./ModulesPage";
import { OfferingGroupsPage } from "./OfferingGroupsPage";
import { OrgStructurePage } from "./OrgStructurePage";
import { RoomsPage } from "./RoomsPage";

type ParamTab =
  | "organisation"
  | "rooms"
  | "activity"
  | "offering"
  | "module";

export function ParameterPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<ParamTab>("organisation");

  return (
    <div className="panel param-page">
      <div className="param-page-head">
        <h2>{t.paramTitle}</h2>
        <p className="lead">{t.paramLede}</p>

        <div className="tabs" role="tablist" aria-label={t.paramTitle}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "organisation"}
            className={tab === "organisation" ? "active" : ""}
            onClick={() => setTab("organisation")}
          >
            {t.paramTabOrg}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rooms"}
            className={tab === "rooms" ? "active" : ""}
            onClick={() => setTab("rooms")}
          >
            {t.paramTabRooms}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "activity"}
            className={tab === "activity" ? "active" : ""}
            onClick={() => setTab("activity")}
          >
            {t.paramTabActivity}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "offering"}
            className={tab === "offering" ? "active" : ""}
            onClick={() => setTab("offering")}
          >
            {t.paramTabOffering}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "module"}
            className={tab === "module" ? "active" : ""}
            onClick={() => setTab("module")}
          >
            {t.paramTabModule}
          </button>
        </div>
      </div>

      <div className="tab-panel param-tab-panel">
        {tab === "organisation" ? (
          <OrgStructurePage />
        ) : tab === "rooms" ? (
          <RoomsPage />
        ) : tab === "activity" ? (
          <ActivitiesPage />
        ) : tab === "offering" ? (
          <OfferingGroupsPage />
        ) : (
          <ModulesPage />
        )}
      </div>
    </div>
  );
}
