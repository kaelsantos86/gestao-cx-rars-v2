import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path, stubs = {}, expose = []) {
 const source = fs.readFileSync(path, 'utf8');
 const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const module = {exports:{}};
 vm.runInNewContext(js + expose.map(n=>`\nexports.${n} = ${n};`).join(''), {module,exports:module.exports,require:id=>id in stubs ? stubs[id] : require(id),FormData,Date,Set,console});
 return module.exports;
}
const pdi = load('src/lib/pdi.ts');
const redirect = path => { throw new Error(`redirect:${path}`); };
const editable = {id:'fixture',status:'participant_submitted',payload:{legacy:'retained',priorities:[{id:'old',title:'Original',evidence:'Evidence',custom:'preserved'}]},latestResponse:{is_submitted:true}};
function manager(record) {
 const writes=[];
 const chain = {eq:()=>chain,in:()=>chain,then:resolve=>Promise.resolve(resolve({error:null}))};
 const supabase = {from:()=>({update:data=>{writes.push(data);return chain;}})};
 const mod=load('src/app/records/[id]/pdi/page.tsx',{
  'next/link':()=>null,'next/navigation':{redirect,notFound:()=>{throw new Error('notfound');}},
  '@/components/pdi-creation-sections':{},'@/components/copy-link':{},
  '@/lib/auth':{requireManager:async()=>({supabase,user:{id:'manager'}})},
  '@/lib/data/records':{getPdiRecord:async()=>record},'@/lib/pdi':pdi,'@/lib/workflow-automation':{}
 },['saveManagerPreparation','generateParticipantLink']);
 return {...mod,writes};
}
test('blank invitation requires no priority; incomplete proposal may be saved but cannot be agreed',()=>{
 assert.equal(pdi.readPdiPriorities(new FormData()).length,0);
 const f=new FormData();f.set('priority_1_title','Learn');
 assert.equal(pdi.readPdiPriorities(f).length,1);
 assert.throws(()=>pdi.readPdiPriorities(f,[],true),/incomplete_priority/);
});
test('editing retains priority identity, unknown fields and omitted formation',()=>{
 const f=new FormData();f.set('priority_1_id','old');f.set('priority_1_title','Updated');
 const items=pdi.readPdiPriorities(f,[{id:'old',title:'Original',custom:'preserved',learningPlan:'Course'}]);
 assert.equal(items[0].id,'old');assert.equal(items[0].custom,'preserved');assert.equal(items[0].learningPlan,'Course');
});
test('manager cannot prepare before submitted perspective',async()=>{
 const m=manager({...editable,latestResponse:null});const f=new FormData();f.set('recordId','fixture');
 await assert.rejects(m.saveManagerPreparation(f),/perspective=decision/);assert.equal(m.writes.length,0);
});
test('active and archived cycles cannot be changed by preparation or invitation',async()=>{
 for(const status of ['active','in_review','completed','archived']) {
  const m=manager({...editable,status}); const f=new FormData();f.set('recordId','fixture');
  await assert.rejects(m.saveManagerPreparation(f),/redirect/);
  await assert.rejects(m.generateParticipantLink(f),/redirect/);assert.equal(m.writes.length,0);
 }
});
test('preparation keeps legacy payload and objectives; does not update participant answers or private notes',async()=>{
 const m=manager(editable);const f=new FormData();f.set('recordId','fixture');f.set('developmentDirection','New direction');
 await assert.rejects(m.saveManagerPreparation(f),/prepared=1/);
 assert.equal(m.writes.length,1);assert.equal(m.writes[0].payload.legacy,'retained');assert.equal(m.writes[0].payload.priorities[0].custom,'preserved');
 assert.equal(m.writes[0].private_notes,undefined);assert.equal(m.writes[0].status,'participant_submitted');
});
test('collaborator questionnaire preserves original keys and adds career and learning questions',()=>{
 const keys=pdi.pdiParticipantFields.map(([k])=>k);
 for(const key of ['professionalMoment','recognizedStrengths','aspirationDirection','desiredDevelopment','practicalExperience','desiredAutonomy','managerSupport','ownCommitment','observations','nextYearGoals','learningInterests','developmentConditions'])assert.ok(keys.includes(key));
 assert.ok(pdi.pdiOptionalParticipantFields.has('learningInterests'));
});
test('incomplete participant submission is saved as a draft, preserving unknown historical fields',async()=>{
 const writes=[];
 const mod=load('src/app/participate/pdi/[token]/page.tsx',{
  'next/navigation':{redirect,notFound:()=>{throw new Error('notfound');}},
  '@/lib/pdi':pdi,
  '@/lib/data/records':{getParticipantPdi:async()=>({locked:false,latest_response:{legacy:'retained',overview:{custom:'preserved'}}})},
  '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{writes.push({name,args});return {error:null};}})}
 },['savePerspective']);
 const f=new FormData();f.set('token','synthetic');f.set('intent','submit');f.set('professionalMoment','Partial reflection');
 await assert.rejects(mod.savePerspective(f),/required=1&saved=1/);
 assert.equal(writes[0].args.submit_response,false);
 assert.equal(writes[0].args.response.overview.professionalMoment,'Partial reflection');
 assert.equal(writes[0].args.response.overview.custom,'preserved');
 assert.equal(writes[0].args.response.legacy,'retained');
});
