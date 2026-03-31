import type { SupabaseClient } from "@supabase/supabase-js";

import type { RobotRegisterInput, RobotState } from "../../contracts/robotics-api";

export async function upsertRobot(params: {
  supabase: SupabaseClient;
  orgId: string;
  input: RobotRegisterInput;
}): Promise<{ robotId: string }> {
  const { supabase, orgId, input } = params;

  const { error } = await supabase.from("robots").upsert(
    {
      org_id: orgId,
      robot_id: input.robot_id,
      name: input.name,
      capabilities: input.capabilities ?? [],
      connection_config: input.connection ?? {},
      status: "idle",
      last_state: {},
    },
    { onConflict: "org_id,robot_id" }
  );

  if (error) throw new Error(`robot_upsert_failed:${error.message}`);
  return { robotId: input.robot_id };
}

export async function updateRobotState(params: {
  supabase: SupabaseClient;
  orgId: string;
  robotId: string;
  state: RobotState;
}): Promise<void> {
  const { supabase, orgId, robotId, state } = params;
  const { error } = await supabase
    .from("robots")
    .update({
      last_state: state as unknown as Record<string, unknown>,
      last_seen_at: new Date().toISOString(),
      status: state.status ?? "idle",
    })
    .eq("org_id", orgId)
    .eq("robot_id", robotId);

  if (error) throw new Error(`robot_state_update_failed:${error.message}`);
}

export async function getRobot(params: {
  supabase: SupabaseClient;
  orgId: string;
  robotId: string;
}): Promise<{
  robotId: string;
  name: string;
  connectionConfig: Record<string, unknown>;
  lastState: Record<string, unknown>;
}> {
  const { supabase, orgId, robotId } = params;
  const { data, error } = await supabase
    .from("robots")
    .select("robot_id,name,connection_config,last_state")
    .eq("org_id", orgId)
    .eq("robot_id", robotId)
    .maybeSingle();

  if (error) throw new Error(`robot_get_failed:${error.message}`);
  if (!data) throw new Error("robot_not_found");
  return {
    robotId: data.robot_id as string,
    name: data.name as string,
    connectionConfig: (data.connection_config ?? {}) as Record<string, unknown>,
    lastState: (data.last_state ?? {}) as Record<string, unknown>,
  };
}

