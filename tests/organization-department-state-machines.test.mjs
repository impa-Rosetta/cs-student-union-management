import {test} from "node:test";
import assert from "node:assert/strict";
import {affairTransition,assessmentTransition,changeTransition} from "../app/organization-department/state-machines.ts";
const applicant={role:"staff",department:"科创中心",username:"staff"};
const organization={role:"leader",department:"组织部",username:"org"};
const chair={role:"chair",department:"主席团",username:"chair"};
test("成员异动按申请人、组织部、主席团两级流转",()=>{assert.deepEqual(changeTransition("草稿","submit",applicant,"staff"),{ok:true,next:"待组织部审核"});assert.deepEqual(changeTransition("待组织部审核","organizationApprove",organization,"staff"),{ok:true,next:"待主席团确认"});assert.deepEqual(changeTransition("待主席团确认","presidiumConfirm",chair,"staff"),{ok:true,next:"已生效"})});
test("成员异动退回后可补充并重新提交",()=>{assert.deepEqual(changeTransition("待组织部审核","organizationReturn",organization,"staff"),{ok:true,next:"待申请人修改"});assert.deepEqual(changeTransition("待申请人修改","resubmit",applicant,"staff"),{ok:true,next:"待组织部审核"});assert.equal(changeTransition("待主席团确认","presidiumConfirm",organization,"staff").ok,false)});
test("考核与组织事务状态机限制最终确认权限",()=>{assert.deepEqual(assessmentTransition("草稿","start",organization),{ok:true,next:"进行中"});assert.deepEqual(assessmentTransition("待确认","confirm",chair),{ok:true,next:"已归档"});assert.equal(assessmentTransition("待确认","confirm",organization).ok,false);assert.deepEqual(affairTransition("草稿","start",organization),{ok:true,next:"办理中"});assert.deepEqual(affairTransition("待结果确认","confirm",chair),{ok:true,next:"已完成"})});
