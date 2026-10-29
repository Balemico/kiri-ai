import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { Team } from "../../game";
import { useSession } from "../useSession";
import { InkSegmentedStroke, InkStrokeButton, Stagger, type InkSegmentOption } from "../../components/atoms";
import { useT } from "../../i18n";
import { BackStroke, TextField } from "./ui";

type View = "choose" | "create" | "join";

const TEAMS: [Team, Team] = ["red", "blue"];

const Heading = ({ title, subtitle }: { title: string; subtitle: string }) => (
	<div style={{ textAlign: "center", color: "#17120e", marginBottom: 10 }}>
		<h1 style={{ margin: 0, fontSize: 28, letterSpacing: 4, fontFamily: "var(--font-display)" }}>{title}</h1>
		<p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.65 }}>{subtitle}</p>
	</div>
);

/**
 * Multiplayer lobby: create a room (keyword + colour) or join one (keyword → the other colour).
 * Each view is a `Stagger` keyed by the view: switching lets the old view lift away, then the new
 * rows — and their ink strokes — arrive one after another. Keyword and colour live here, above
 * the keyed views, so they survive switching between them.
 */
export const MultiplayerLobby = ({ onBack }: { onBack: () => void }) => {
	const { createRoom, joinRoom } = useSession();
	const [view, setView] = useState<View>("choose");
	const [keyword, setKeyword] = useState("");
	const [color, setColor] = useState<Team>("red");
	const t = useT();
	// Memoised: a stable identity (per language), so the toggle doesn't re-register its stroke every render.
	const teamOptions = useMemo<[InkSegmentOption, InkSegmentOption]>(
		() => [
			{ label: t("team.red"), tone: "red" },
			{ label: t("team.blue"), tone: "blue" },
		],
		[t],
	);

	const trimmed = keyword.trim();

	return (
		// `propagate`: when the whole multiplayer screen leaves (outer AnimatePresence in Lobby), the
		// current view's rows still run their exit cascade instead of vanishing.
		<AnimatePresence mode="wait" propagate>
			{view === "choose" && (
				<Stagger key="choose">
					<Heading title={t("mp.title")} subtitle={t("mp.subtitle")} />
					<InkStrokeButton tone="red" variant={0} onClick={() => setView("create")}>
						{t("mp.createMatch")}
					</InkStrokeButton>
					<InkStrokeButton tone="blue" variant={1} onClick={() => setView("join")}>
						{t("mp.join")}
					</InkStrokeButton>
					<BackStroke onClick={onBack}>{t("mp.back")}</BackStroke>
				</Stagger>
			)}

			{view === "create" && (
				<Stagger key="create" gap={12}>
					<Heading title={t("mp.createTitle")} subtitle={t("mp.createSubtitle")} />
					<TextField value={keyword} onChange={setKeyword} placeholder={t("mp.keywordExample")} onEnter={() => trimmed && createRoom(trimmed, color)} />
					{/* One stroke, two halves: the chosen colour lights its half, the other goes grey. */}
					<InkSegmentedStroke options={teamOptions} value={TEAMS.indexOf(color) as 0 | 1} onChange={(i) => setColor(TEAMS[i])} variant={1} />
					<InkStrokeButton disabled={!trimmed} onClick={() => createRoom(trimmed, color)}>
						{t("mp.createAndWait")}
					</InkStrokeButton>
					<BackStroke onClick={() => setView("choose")}>{t("mp.back")}</BackStroke>
				</Stagger>
			)}

			{view === "join" && (
				<Stagger key="join" gap={12}>
					<Heading title={t("mp.joinTitle")} subtitle={t("mp.joinSubtitle")} />
					<TextField value={keyword} onChange={setKeyword} placeholder={t("mp.keyword")} onEnter={() => trimmed && joinRoom(trimmed)} />
					<p style={{ margin: 0, fontSize: 12, opacity: 0.6, textAlign: "center", color: "#17120e" }}>
						{t("mp.joinNote")}
					</p>
					<InkStrokeButton disabled={!trimmed} onClick={() => joinRoom(trimmed)}>
						{t("mp.join")}
					</InkStrokeButton>
					<BackStroke onClick={() => setView("choose")}>{t("mp.back")}</BackStroke>
				</Stagger>
			)}
		</AnimatePresence>
	);
};
