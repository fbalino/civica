import { and, eq, ilike } from "drizzle-orm";
import { electionResults, elections, statements } from "@/lib/db/schema";
type Db=typeof import("@/lib/db").db;
export type ElectionInput=typeof elections.$inferInsert; export type ElectionResultInput=Omit<typeof electionResults.$inferInsert,"electionId">;
export async function writeElection(db:Db,input:{election:ElectionInput;results?:ElectionResultInput[];provenance:{predicate:string;objectValue:string;sourceId:string;sourceUrl:string;sourceLicense:string}},options:{dryRun?:boolean}={}){
  if(!input.election.jurisdictionId||!input.election.electionDate||!input.election.electionType)throw new Error("Malformed election fixture");
  const resultNames=new Set<string>();for(const r of input.results??[]){if(!r.partyName||resultNames.has(r.partyName))throw new Error(`Duplicate/malformed election result: ${r.partyName}`);resultNames.add(r.partyName);}
  if(options.dryRun)return{inserted:1,updated:0,resultsWritten:input.results?.length??0,written:0};
  let match:string|null=null;if(input.election.wikidataQid){const byQid=await db.select({id:elections.id}).from(elections).where(eq(elections.wikidataQid,input.election.wikidataQid)).limit(1);match=byQid[0]?.id??null;}
  if(!match){const byNatural=await db.select({id:elections.id}).from(elections).where(and(eq(elections.jurisdictionId,input.election.jurisdictionId),eq(elections.electionDate,input.election.electionDate),ilike(elections.electionType,input.election.electionType))).limit(1);match=byNatural[0]?.id??null;}
  let electionId:string;let inserted=0;let updated=0;if(match){electionId=match;await db.update(elections).set(input.election).where(eq(elections.id,electionId));updated=1;}else{const row=await db.insert(elections).values(input.election).returning({id:elections.id});electionId=row[0].id;inserted=1;}
  if(input.results){await db.delete(electionResults).where(eq(electionResults.electionId,electionId));for(const result of input.results)await db.insert(electionResults).values({electionId,...result});}
  const existing=await db.select({id:statements.id}).from(statements).where(and(eq(statements.subjectTable,"elections"),eq(statements.subjectId,electionId),eq(statements.predicate,input.provenance.predicate),eq(statements.sourceId,input.provenance.sourceId))).limit(1);const value={objectValue:input.provenance.objectValue,sourceId:input.provenance.sourceId,sourceUrl:input.provenance.sourceUrl,sourceLicense:input.provenance.sourceLicense,retrievedAt:new Date()};if(existing[0])await db.update(statements).set(value).where(eq(statements.id,existing[0].id));else await db.insert(statements).values({subjectTable:"elections",subjectId:electionId,predicate:input.provenance.predicate,...value});
  return{inserted,updated,resultsWritten:input.results?.length??0,written:1};
}
