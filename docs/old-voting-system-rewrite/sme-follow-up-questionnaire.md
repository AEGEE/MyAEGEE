# SME Follow-up Questionnaire

## AEGEE OMS Voting System Rewrite - Phase 2

## Purpose

This follow-up questionnaire addresses the remaining questions from the initial SME questionnaire that require clarification for completing the voting system requirements. Based on your previous responses, we need additional details on the following areas.

---

## Section 1: Outstanding Voting Rules Questions

### 1.1 Tied Vote Resolution

**Q1.1.1: How are tied votes resolved in different scenarios?**

Based on your previous input on voting methods:

**Simple majority ties:**

- What happens when votes for = votes against?
- Is there a deciding vote mechanism?
- Does the proposal fail or require revoting?

**Schulze method ties:**

- How are ties handled in candidate elections?
- Is there a run-off procedure?
- Who makes the final decision in case of mathematical ties?

**Who has the deciding vote in ties:**

- Does the Chair have a casting vote?
- Is there a specific protocol for tie-breaking?

### 1.2 Quorum Requirements Clarification

**Q1.2.1: Different quorum requirements by vote type**

You mentioned 50% quorum for Ordinary Members for statute changes. Please clarify:

**Constitutional amendments:** **_% quorum required
**Policy proposals:** _**% quorum required
**Procedural motions:** \_\_\_% quorum required
**Pre-Agora voting:** 50% of Antennae (confirmed)

**Does quorum change when delegates depart during Agora?**

- Is quorum calculated at start of session or continuously?
- What happens if quorum is lost during voting?

---

## Section 2: Integration and System Requirements

### 2.1 External System Integration

**Q2.1.1: What external systems need integration?**

**AEGEE membership database:**

- Real-time sync required? Yes/No
- Sync frequency: **\_\_\_\_**
- What specific data needs to be synchronized?
  - [ ] Member counts for vote allocation
  - [ ] Antenna status changes
  - [ ] Delegate eligibility
  - [ ] Contact antenna status
  - [ ] Other: **\_\_\_\_**

**Other systems:**

- External CIA management tools? **\_\_\_\_**
- Notification systems? **\_\_\_\_**
- Reporting/analytics tools? **\_\_\_\_**

### 2.2 Data Export and Reporting

**Q2.2.1: What reports are required after each Agora?**

- [ ] Official voting results
- [ ] Attendance reports
- [ ] Participation statistics
- [ ] Audit trail summaries
- [ ] Proxy voting reports
- [ ] Amendment tracking reports
- [ ] CIA change summaries
- [ ] Other: **\_\_\_\_**

**Who needs access to these reports?**

- [ ] JC members
- [ ] Comité Directeur
- [ ] All antennae
- [ ] AEGEE-Europe board
- [ ] External auditors
- [ ] Other: **\_\_\_\_**

---

## Section 3: Emergency Procedures and Edge Cases

### 3.1 Emergency Override Capabilities

**Q3.1.1: What emergency override capabilities are needed?**

You mentioned "there are no emergency procedures," but we need to clarify:

- Can chairs override system decisions in case of technical failure? Yes/No
- Who can authorize manual vote recording if system fails? **\_\_\_\_**
- What constitutes a voting emergency requiring manual intervention?
  - [ ] Complete system failure during voting
  - [ ] Network connectivity issues
  - [ ] Database corruption
  - [ ] Security breach
  - [ ] Other: **\_\_\_\_**

**What backup voting methods should exist?**

- [ ] Paper ballot backup
- [ ] Alternative electronic system
- [ ] Email-based voting
- [ ] Postponement procedures
- [ ] Other: **\_\_\_\_**

### 3.2 System Failure Protocols

**Q3.2.1: How should system failures be handled?**

- Maximum acceptable downtime during voting: **\_** minutes
- Who has authority to switch to backup systems? **\_\_\_\_**
- How are votes preserved if system fails mid-voting? **\_\_\_\_**
- What verification is needed when resuming from backup? **\_\_\_\_**

---

## Section 4: Current System Issues and Success Criteria

### 4.1 Current System Problems

**Q4.1.1: What are the top 5 problems with the current voting system?**

Please identify the most critical issues that the new system must address:

1. ***
2. ***
3. ***
4. ***
5. ***

### 4.2 Success Criteria

**Q4.2.1: How will we measure the success of the new system?**

Please rank these criteria by importance (1 = most important):

- [ ] Faster vote counting (Rank: \_\_\_)
- [ ] Reduced technical issues (Rank: \_\_\_)
- [ ] Better user experience (Rank: \_\_\_)
- [ ] Improved audit capabilities (Rank: \_\_\_)
- [ ] Higher delegate participation (Rank: \_\_\_)
- [ ] Better CIA management (Rank: \_\_\_)
- [ ] Simplified proxy voting (Rank: \_\_\_)
- [ ] Real-time transparency (Rank: \_\_\_)
- [ ] Other: **\_\_\_\_** (Rank: \_\_\_)

**What specific metrics should we track?**

- Average voting session duration: Target **\_** minutes
- System uptime during Agora: Target **\_**%
- User satisfaction score: Target **\_**/10
- Time to publish results: Target **\_** minutes after vote close
- Other metrics: **\_\_\_\_**

---

## Section 5: Future Requirements and Roadmap

### 5.1 Anticipated Changes

**Q5.1.1: Are there planned changes to AEGEE voting procedures?**

- Anticipated changes to vote allocation formulas? **\_\_\_\_**
- New voting methods being considered? **\_\_\_\_**
- Changes to delegate limits or antenna classification? **\_\_\_\_**
- Timeline for any known changes? **\_\_\_\_**

### 5.2 Additional Features

**Q5.2.1: What additional features might be needed in the future?**

Please indicate priority level (High/Medium/Low):

- [ ] Candidate elections (Priority: **\_**)
- [ ] Working group elections (Priority: **\_**)
- [ ] Opinion polls/surveys (Priority: **\_**)
- [ ] Committee vote tracking (Priority: **\_**)
- [ ] Regional Agora support (Priority: **\_**)
- [ ] Multi-language support (Priority: **\_**)
- [ ] Mobile voting application (Priority: **\_**)
- [ ] Integration with video conferencing (Priority: **\_**)
- [ ] Automated proposal analysis (Priority: **\_**)
- [ ] Other: **\_\_\_\_** (Priority: **\_**)

---

## Section 6: Technical Constraints and Preferences

### 6.1 Performance Requirements

**Q6.1.1: What are the performance expectations?**

- Maximum number of concurrent voters: **\_\_\_\_**
- Expected peak voting load: **\_\_\_\_** votes per minute
- Acceptable response time for vote submission: **\_\_\_\_** seconds
- Maximum time for result calculation: **\_\_\_\_** seconds

### 6.2 User Experience Priorities

**Q6.2.1: What are the most important UX considerations?**

Please rank by importance (1 = most important):

- [ ] Intuitive voting interface (Rank: \_\_\_)
- [ ] Clear proposal display (Rank: \_\_\_)
- [ ] Real-time feedback (Rank: \_\_\_)
- [ ] Mobile responsiveness (Rank: \_\_\_)
- [ ] Accessibility compliance (Rank: \_\_\_)
- [ ] Multi-language support (Rank: \_\_\_)
- [ ] Offline capability (Rank: \_\_\_)

---

## Section 7: Implementation and Training

### 7.1 Training Requirements

**Q7.1.1: What training will be needed for the new system?**

**For JC members:**

- Training duration needed: **\_\_\_\_** hours
- Key focus areas: **\_\_\_\_**
- Preferred training format: **\_\_\_\_**

**For delegates:**

- Training materials needed: **\_\_\_\_**
- Self-service help requirements: **\_\_\_\_**
- Support during first use: **\_\_\_\_**

### 7.2 Rollout Strategy

**Q7.2.1: How should the new system be introduced?**

- [ ] Pilot with small group first
- [ ] Full deployment for next Agora
- [ ] Parallel running with old system
- [ ] Phased rollout by feature
- [ ] Other: **\_\_\_\_**

**Risk tolerance for first production use:**

- [ ] Conservative - extensive testing required
- [ ] Moderate - standard testing acceptable
- [ ] Aggressive - minimal viable product acceptable

---

## Completion Information

**Name:** ********\_\_\_\_********

**Role:** ********\_\_\_\_********

**Date Completed:** ********\_\_\_\_********

**Priority Level for Implementation:** ********\_\_\_\_********

**Additional Comments:**

---

---

---

---

## Next Steps

Based on these responses, the development team will:

1. ✅ Update technical specifications
2. ✅ Finalize database schema requirements
3. ✅ Create detailed user stories
4. ✅ Update lead developer questionnaire
5. ✅ Define testing requirements
6. ✅ Create implementation timeline

**Estimated completion timeline for answers:** **\_\_\_\_**

**Preferred communication method for follow-up questions:** **\_\_\_\_**
