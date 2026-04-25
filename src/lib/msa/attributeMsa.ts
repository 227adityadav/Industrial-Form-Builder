/**
 * Simple attribute agreement — two appraisers vs optional reference.
 * Cohen's κ for binary (Pass=1, Fail=0); agreement % without chance correction.
 */

export type AttributeRating = "P" | "F" | "";

export type AttributeRow = {
  part: string;
  appraiser1: AttributeRating;
  appraiser2: AttributeRating;
  reference?: AttributeRating;
};

function toBit(r: AttributeRating): 0 | 1 | null {
  if (r === "P") return 1;
  if (r === "F") return 0;
  return null;
}

export type AttributeMsaResult = {
  n: number;
  /** Both appraisers rated and agree */
  agreement12: number;
  pctAgreement12: number;
  kappa12: number | null;
  /** vs reference when both A1 and ref valid */
  agreement1Ref: number | null;
  pctAgreement1Ref: number | null;
  agreement2Ref: number | null;
  pctAgreement2Ref: number | null;
};

function cohenKappa(a: (0 | 1)[], b: (0 | 1)[]): number | null {
  if (a.length !== b.length || a.length === 0) return null;
  let n00 = 0,
    n01 = 0,
    n10 = 0,
    n11 = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 0 && b[i] === 0) n00++;
    else if (a[i] === 0 && b[i] === 1) n01++;
    else if (a[i] === 1 && b[i] === 0) n10++;
    else if (a[i] === 1 && b[i] === 1) n11++;
    else return null;
  }
  const n = n00 + n01 + n10 + n11;
  const po = (n00 + n11) / n;
  const pYesA = (n10 + n11) / n;
  const pNoA = 1 - pYesA;
  const pYesB = (n01 + n11) / n;
  const pNoB = 1 - pYesB;
  const pe = pYesA * pYesB + pNoA * pNoB;
  if (pe >= 1) return po === 1 ? 1 : null;
  return (po - pe) / (1 - pe);
}

export function computeAttributeMsa(rows: AttributeRow[]): AttributeMsaResult {
  const a1: (0 | 1)[] = [];
  const a2: (0 | 1)[] = [];
  const r1: (0 | 1)[] = [];
  const r2: (0 | 1)[] = [];
  let agree12 = 0;
  let valid12 = 0;
  let agree1Ref = 0,
    valid1Ref = 0;
  let agree2Ref = 0,
    valid2Ref = 0;

  for (const row of rows) {
    const b1 = toBit(row.appraiser1);
    const b2 = toBit(row.appraiser2);
    const ref = row.reference != null ? toBit(row.reference) : null;

    if (b1 != null && b2 != null) {
      valid12++;
      if (b1 === b2) agree12++;
      a1.push(b1);
      a2.push(b2);
    }
    if (b1 != null && ref != null) {
      valid1Ref++;
      if (b1 === ref) agree1Ref++;
      r1.push(b1);
    }
    if (b2 != null && ref != null) {
      valid2Ref++;
      if (b2 === ref) agree2Ref++;
      r2.push(b2);
    }
  }

  const kappa12 = a1.length ? cohenKappa(a1, a2) : null;

  return {
    n: rows.length,
    agreement12: agree12,
    pctAgreement12: valid12 ? (100 * agree12) / valid12 : 0,
    kappa12,
    agreement1Ref: valid1Ref ? agree1Ref : null,
    pctAgreement1Ref: valid1Ref ? (100 * agree1Ref) / valid1Ref : null,
    agreement2Ref: valid2Ref ? agree2Ref : null,
    pctAgreement2Ref: valid2Ref ? (100 * agree2Ref) / valid2Ref : null,
  };
}
