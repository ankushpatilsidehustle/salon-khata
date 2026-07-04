export type ConflictCandidate = {
  updatedAt: string;
  source: "local" | "cloud";
};

export function chooseLastWriteWinner(local: ConflictCandidate, cloud: ConflictCandidate) {
  return new Date(local.updatedAt).getTime() >= new Date(cloud.updatedAt).getTime()
    ? local
    : cloud;
}