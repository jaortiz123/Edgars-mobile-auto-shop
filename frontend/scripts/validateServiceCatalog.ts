#!/usr/bin/env ts-node
/**
 * Integrity validator for serviceCatalog.json
 * Checks:
 *  - Unique id & slug
 *  - All relationship references exist
 *  - No self references in recommendations/exclusions
 *  - No bundle cycles (shallow detection)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ServiceDefinition } from '../src/types/serviceCatalog';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const catalogPath = path.join(__dirname, '..', 'src', 'data', 'serviceCatalog.json');
const raw = fs.readFileSync(catalogPath, 'utf8');
const data: ServiceDefinition[] = JSON.parse(raw);

let ok = true;
const idSet = new Set<string>();
const slugSet = new Set<string>();
const idMap = new Map<string, ServiceDefinition>();

for (const svc of data) {
  if (idSet.has(svc.id)) { console.error(`Duplicate id: ${svc.id}`); ok = false; }
  if (slugSet.has(svc.slug)) { console.error(`Duplicate slug: ${svc.slug}`); ok = false; }
  idSet.add(svc.id); slugSet.add(svc.slug); idMap.set(svc.id, svc);
}

function checkRefs(label: string, list?: string[], selfId?: string) {
  if (!list) return;
  for (const ref of list) {
    if (ref === selfId) { console.error(`${label}: self reference (${selfId})`); ok = false; }
    if (!idMap.has(ref)) { console.error(`${label}: missing reference ${ref} (in ${selfId})`); ok = false; }
  }
}

for (const svc of data) {
  checkRefs('bundleChildServiceIds', svc.bundleChildServiceIds, svc.id);
  checkRefs('recommendedServiceIds', svc.recommendedServiceIds, svc.id);
  checkRefs('mutuallyExclusiveServiceIds', svc.mutuallyExclusiveServiceIds, svc.id);
  // Simple cycle detection for bundles (depth 1)
  if (svc.bundleChildServiceIds) {
    for (const child of svc.bundleChildServiceIds) {
      const childDef = idMap.get(child);
      if (childDef?.bundleChildServiceIds?.includes(svc.id)) {
        console.error(`Bundle cycle: ${svc.id} <-> ${child}`); ok = false;
      }
    }
  }
}

if (!ok) {
  console.error('Service catalog validation FAILED');
  process.exit(1);
}
console.log('Service catalog validation OK. Total services:', data.length);
