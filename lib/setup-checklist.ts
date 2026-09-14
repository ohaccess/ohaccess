// The "Get set up" checklist at the top of a new agent's dashboard. Pure, so
// the rules live in one tested place and the card only draws them.
//
// Every step is worked out from data ohACCESS already has (no extra columns),
// except "printed their sign", which only the browser knows about. That flag
// lives in localStorage, so on a second device it can start unticked; the
// whole card disappears as soon as the first visitor signs in, which settles
// it for good.

export type SetupStepId = 'profile' | 'open_house' | 'sign'

export type SetupStep = { id: SetupStepId; done: boolean }

export type SetupInput = {
  profile: { full_name?: string | null; headshot_url?: string | null; logo_url?: string | null } | null
  openHouseCount: number
  signSaved: boolean
}

const filled = (s: string | null | undefined) => !!s && s.trim().length > 0

export function setupSteps({ profile, openHouseCount, signSaved }: SetupInput): SetupStep[] {
  return [
    // Name plus a face or a logo: what visitors see in every email from the
    // agent. A team member's logo is mirrored onto their profile by the team,
    // so it counts here too.
    { id: 'profile', done: filled(profile?.full_name) && (filled(profile?.headshot_url) || filled(profile?.logo_url)) },
    { id: 'open_house', done: openHouseCount > 0 },
    { id: 'sign', done: signSaved },
  ]
}

// Shown only while there's something left to do AND nobody has signed in yet.
// A first visitor proves the agent is up and running, whatever the ticks say.
// Locked (trial used up) accounts never see it: they can't act on any step.
export function showSetupChecklist(steps: SetupStep[], totalVisitors: number | null, locked: boolean): boolean {
  if (locked) return false
  if (totalVisitors === null || totalVisitors > 0) return false
  return steps.some(s => !s.done)
}

// Per-agent, so two agents sharing a computer don't tick each other's box.
export const signSavedKey = (agentId: string) => `ohaccess_sign_saved_${agentId}`
