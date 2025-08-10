# Business Rules and Algorithms

## Overview

This document outlines the core business rules, algorithms, and organizational requirements that govern the AEGEE Online Membership System. These rules ensure compliance with AEGEE statutes and provide the logical foundation for all system operations.

## Organizational Context

### AEGEE Structure

AEGEE (Association des États Généraux des Étudiants de l'Europe) is a European student organization with:

- **Antennae**: Local AEGEE groups in cities across Europe
- **Contact Antennae**: Developing groups working toward full status
- **Working Groups**: European-level specialized groups
- **Bodies**: Collective term for all organizational units

### Governance Framework

- **Agora**: Statutory meeting held twice yearly (Spring/Autumn)
- **CIA**: Constitutional and Internal Affairs document
- **JC**: Judicial Committee responsible for constitutional matters
- **Democratic Principles**: Transparent, accountable decision-making

## Vote Allocation and Distribution

### Fundamental Principles

#### 1. Proportional Representation

Vote allocation is based on antenna membership size to ensure fair representation while maintaining practical voting procedures.

#### 2. Equal Distribution Among Delegates

Votes allocated to an antenna must be distributed as equally as possible among registered delegates from that antenna.

#### 3. Maximum Difference Rule

The difference in votes between any two delegates from the same antenna cannot exceed one vote.

### Vote Allocation Algorithm

#### Basic Calculation

```
For antenna with membership M:
- Vote allocation V = f(M) based on AEGEE membership formula
- Maximum 3 voting delegates per antenna
- Minimum 1 vote per antenna (for full antennae)

AEGEE membership-to-vote mapping (based on SME input):
- 1-20 members: 1 vote
- 21-50 members: 2 votes
- 51-100 members: 3 votes
- 101-150 members: 4 votes
- 151-200 members: 5 votes
- 201-250 members: 6 votes
- 251-350 members: 7 votes
- 351-450 members: 8 votes
- 451-550 members: 9 votes
- 551-650 members: 10 votes
- 651-750 members: 11 votes
- 751-850 members: 12 votes
- 851-950 members: 13 votes
- 951+ members: 14 votes plus one additional vote for every 250 additional members

Special antenna types:
- Contact Antennae: 0 votes (envoys have speaking rights only)
- Partner Associations: Follow same formula as regular antennae
```

#### Distribution Algorithm

```python
def distribute_votes(total_votes, num_delegates):
    """
    Distribute votes among delegates following AEGEE rules

    Args:
        total_votes: Total votes allocated to antenna
        num_delegates: Number of registered delegates (max 3)

    Returns:
        list: Vote allocation per delegate
    """
    base_votes = total_votes // num_delegates
    extra_votes = total_votes % num_delegates

    allocation = [base_votes] * num_delegates

    # Distribute extra votes (antenna decides which delegates get extra)
    for i in range(extra_votes):
        allocation[i] += 1

    return allocation

# Example: 7 votes, 3 delegates
# Result: [3, 2, 2] or [2, 3, 2] or [2, 2, 3]
# Antenna decides distribution of the extra vote
```

#### Real-time Vote Tracking

```python
def validate_vote_usage(antenna_id, delegate_votes_cast):
    """
    Validate that vote usage follows distribution rules

    Args:
        antenna_id: Antenna identifier
        delegate_votes_cast: Dict of {delegate_id: votes_cast}

    Returns:
        bool: True if valid, False otherwise
    """
    antenna_info = get_antenna_info(antenna_id)
    total_allocated = antenna_info.total_votes
    max_per_delegate = calculate_max_per_delegate(antenna_info)

    total_used = sum(delegate_votes_cast.values())

    # Check constraints
    if total_used > total_allocated:
        return False

    for delegate_id, votes_used in delegate_votes_cast.items():
        if votes_used > max_per_delegate[delegate_id]:
            return False

    return True
```

### Vote Distribution Flexibility

#### Antenna Autonomy

- Antennae decide how to distribute extra votes among their delegates
- Distribution can be changed during the Agora (with proper authorization)
- Decisions must be documented and authorized by antenna leadership

#### Dynamic Redistribution

```python
def redistribute_votes(antenna_id, new_distribution):
    """
    Handle vote redistribution during Agora

    Args:
        antenna_id: Antenna identifier
        new_distribution: New vote allocation per delegate

    Returns:
        bool: Success status
    """
    # Validate new distribution follows rules
    if not validate_distribution_rules(new_distribution):
        return False

    # Check if votes are already cast
    current_usage = get_current_vote_usage(antenna_id)
    if redistribution_conflicts_with_usage(current_usage, new_distribution):
        return False

    # Apply new distribution
    update_vote_allocation(antenna_id, new_distribution)
    log_redistribution(antenna_id, new_distribution)

    return True
```

## Proxy Voting Management

### Proxy Authorization Process

Based on AEGEE Statutes Article 14 and Working Format Article 18, proxy voting allows antennae to transfer voting rights under extraordinary circumstances.

#### Eligibility and Requirements

```python
def validate_proxy_request(antenna_id, proxy_data):
    """
    Validate proxy voting request according to AEGEE rules

    Args:
        antenna_id: Antenna requesting proxy
        proxy_data: Proxy request details

    Returns:
        dict: Validation results and requirements
    """
    requirements = {
        'extraordinary_circumstances': False,
        'cd_approval': False,
        'timeline_compliance': False,
        'documentation_complete': False,
        'receiving_antenna_consent': False
    }

    # Check timeline requirements
    agora_date = get_agora_date(proxy_data['agora_id'])
    submission_date = proxy_data['submission_date']

    # Must communicate intention 45 days before Agora
    intention_deadline = agora_date - timedelta(days=45)
    cd_decision_deadline = agora_date - timedelta(days=30)
    proxy_document_deadline = agora_date - timedelta(days=14)

    requirements['timeline_compliance'] = (
        proxy_data['intention_date'] <= intention_deadline and
        proxy_data['document_date'] <= proxy_document_deadline
    )

    # Validate extraordinary circumstances
    valid_circumstances = [
        'strict_national_travel_restrictions',
        'justified_fear_of_political_consequences',
        'force_majeure_events'
    ]

    requirements['extraordinary_circumstances'] = (
        proxy_data['circumstances'] in valid_circumstances
    )

    # Check required documentation
    required_docs = [
        'signed_authorization_document',
        'presidents_signatures',
        'receiving_delegate_signature',
        'local_agora_minutes'  # May be requested by CD
    ]

    requirements['documentation_complete'] = all(
        doc in proxy_data['documents'] for doc in required_docs
    )

    return requirements

def process_proxy_authorization(proxy_request):
    """
    Process complete proxy authorization workflow

    Timeline:
    - T-45 days: Antenna submits intention and circumstances to CD
    - T-30 days: CD decision communicated to antenna and JC
    - T-14 days: Proxy document submitted to JC
    - Agora: CD decision ratified by Agora
    """
    workflow_steps = {
        'cd_review': validate_extraordinary_circumstances(proxy_request),
        'jc_documentation': validate_proxy_documents(proxy_request),
        'agora_ratification': schedule_proxy_ratification(proxy_request)
    }

    return workflow_steps
```

#### Vote Transfer Implementation

```python
def transfer_proxy_votes(proxy_authorization):
    """
    Transfer votes from absent antenna to receiving antenna

    Args:
        proxy_authorization: Validated proxy authorization

    Returns:
        dict: Transfer results and vote allocation
    """
    absent_antenna = proxy_authorization['absent_antenna']
    receiving_antenna = proxy_authorization['receiving_antenna']

    # Get vote allocation for absent antenna
    absent_votes = get_antenna_vote_allocation(absent_antenna['id'])

    # Transfer votes to receiving antenna
    transfer_result = {
        'absent_antenna': absent_antenna['id'],
        'receiving_antenna': receiving_antenna['id'],
        'transferred_votes': absent_votes,
        'new_total_votes': receiving_antenna['votes'] + absent_votes,
        'timestamp': datetime.utcnow()
    }

    # Update receiving antenna's vote allocation
    update_antenna_votes(
        receiving_antenna['id'],
        transfer_result['new_total_votes']
    )

    # Mark absent antenna as proxy-transferred
    mark_antenna_proxy_status(absent_antenna['id'], 'transferred')

    # Log the transfer for audit purposes
    log_proxy_transfer(transfer_result)

    return transfer_result

def handle_proxy_ratification(agora_id, proxy_decisions):
    """
    Handle Agora ratification of CD proxy decisions

    Args:
        agora_id: Current Agora identifier
        proxy_decisions: List of CD proxy decisions to ratify

    Returns:
        dict: Ratification results
    """
    ratification_results = {}

    for proxy_decision in proxy_decisions:
        # Vote on proxy ratification
        vote_result = conduct_proxy_ratification_vote(
            agora_id,
            proxy_decision['id']
        )

        if vote_result['approved']:
            # Confirm proxy transfer
            confirm_proxy_transfer(proxy_decision['id'])
            ratification_results[proxy_decision['id']] = 'approved'
        else:
            # Reverse proxy transfer
            reverse_proxy_transfer(proxy_decision['id'])
            ratification_results[proxy_decision['id']] = 'rejected'

    return ratification_results
```

## Quorum Requirements

### Basic Quorum Calculation

```python
def calculate_quorum(agora_id):
    """
    Calculate required quorum for voting

    Args:
        agora_id: Current Agora identifier

    Returns:
        int: Required number of antennae for quorum
    """
    voting_bodies = get_voting_bodies(agora_id)

    # Count full antennae and AEGEE Working Groups
    full_antennae = count_full_antennae(voting_bodies)
    aegee_wgs = count_aegee_working_groups(voting_bodies)

    total_voting_rights = full_antennae + aegee_wgs

    # Quorum = 50% + 1
    return (total_voting_rights // 2) + 1
```

### Dynamic Quorum Tracking

```python
def check_current_quorum(agora_id, plenary_id):
    """
    Check if current attendance meets quorum

    Args:
        agora_id: Current Agora
        plenary_id: Current plenary session

    Returns:
        dict: Quorum status information
    """
    required_quorum = calculate_quorum(agora_id)
    present_bodies = get_present_voting_bodies(plenary_id)

    return {
        'required': required_quorum,
        'present': len(present_bodies),
        'met': len(present_bodies) >= required_quorum,
        'missing': max(0, required_quorum - len(present_bodies))
    }
```

## Voting Thresholds and Procedures

### Threshold Types

#### Simple Majority

```python
def simple_majority_check(votes_for, votes_against, abstentions):
    """
    Check if proposal passes with simple majority

    Args:
        votes_for: Number of votes in favor
        votes_against: Number of votes against
        abstentions: Number of abstentions

    Returns:
        bool: True if passed
    """
    total_decisive_votes = votes_for + votes_against
    return votes_for > votes_against and votes_for > (total_decisive_votes / 2)
```

#### Two-Thirds Majority

```python
def two_thirds_majority_check(votes_for, votes_against, abstentions):
    """
    Check if proposal passes with 2/3 majority

    Args:
        votes_for: Number of votes in favor
        votes_against: Number of votes against
        abstentions: Number of abstentions

    Returns:
        bool: True if passed
    """
    total_votes = votes_for + votes_against + abstentions
    required_votes = (total_votes * 2) / 3
    return votes_for >= required_votes
```

### Proposal-Specific Rules

#### Constitutional Amendments

- **Threshold**: Two-thirds majority of all registered antennae
- **Quorum**: Standard quorum required throughout voting
- **Timeline**: Minimum notice period before voting
- **JC Approval**: Must have JC recommendation before voting

#### Policy Decisions

- **Threshold**: Simple majority of votes cast
- **Quorum**: Standard quorum required
- **Timeline**: Standard notice period
- **Process**: Can proceed without JC pre-approval

#### Emergency Procedures

- **Threshold**: Higher threshold may apply
- **Process**: Expedited procedures with special authorization
- **Restrictions**: Limited scope of emergency proposals
- **Documentation**: Enhanced documentation requirements

## Attendance and Participation Rules

### Attendance Requirements

#### Delegate Attendance

```python
def calculate_attendance_percentage(delegate_id, agora_id):
    """
    Calculate delegate attendance percentage

    Args:
        delegate_id: Delegate identifier
        agora_id: Current Agora

    Returns:
        float: Attendance percentage
    """
    total_sessions = get_total_plenary_sessions(agora_id)
    attended_sessions = get_attended_sessions(delegate_id, agora_id)

    return (attended_sessions / total_sessions) * 100
```

#### Voting Eligibility

```python
def check_voting_eligibility(delegate_id, proposal_id):
    """
    Check if delegate is eligible to vote on specific proposal

    Args:
        delegate_id: Delegate identifier
        proposal_id: Proposal identifier

    Returns:
        dict: Eligibility status and reasons
    """
    delegate = get_delegate(delegate_id)
    proposal = get_proposal(proposal_id)

    checks = {
        'registered': delegate.is_registered_for_agora(),
        'present': delegate.is_currently_present(),
        'attendance_sufficient': delegate.attendance_percentage >= 50,
        'no_conflicts': not has_voting_conflicts(delegate_id, proposal_id)
    }

    return {
        'eligible': all(checks.values()),
        'checks': checks,
        'reasons': get_ineligibility_reasons(checks)
    }
```

### Attendance Tracking

#### Check-in/Check-out Process

```python
def process_attendance_scan(delegate_id, scan_time, scan_type):
    """
    Process barcode scan for attendance tracking

    Args:
        delegate_id: Delegate identifier
        scan_time: Timestamp of scan
        scan_type: 'checkin' or 'checkout'

    Returns:
        dict: Processing result
    """
    current_plenary = get_current_plenary()

    if scan_type == 'checkin':
        result = record_checkin(delegate_id, current_plenary, scan_time)
    else:
        result = record_checkout(delegate_id, current_plenary, scan_time)

    # Update real-time quorum status
    update_quorum_status(current_plenary)

    return result
```

## Proposal Management Rules

### Submission Requirements

#### Eligibility Criteria

```python
def validate_proposal_submission(proposal_data):
    """
    Validate proposal submission against AEGEE rules

    Args:
        proposal_data: Proposal submission data

    Returns:
        dict: Validation result
    """
    checks = {
        'deadline_met': proposal_data.submit_date <= get_submission_deadline(),
        'proposer_eligible': validate_proposer_eligibility(proposal_data.proposer),
        'supporters_sufficient': len(proposal_data.supporters) >= MIN_SUPPORTERS,
        'cia_references_valid': validate_cia_references(proposal_data.cia_changes),
        'format_correct': validate_proposal_format(proposal_data)
    }

    return {
        'valid': all(checks.values()),
        'checks': checks,
        'errors': get_validation_errors(checks)
    }
```

#### Supporting Requirements

- **Minimum Supporters**: Typically 3-5 antennae must support proposal
- **Proposer Eligibility**: Must be full antenna or eligible working group
- **Documentation**: Complete motivation and implementation plan required

### JC Review Process

#### Review Timeline

```python
def calculate_review_deadlines(submission_date):
    """
    Calculate JC review deadlines based on submission date

    Args:
        submission_date: Date proposal was submitted

    Returns:
        dict: Important deadlines
    """
    return {
        'initial_review': submission_date + timedelta(days=14),
        'feedback_deadline': submission_date + timedelta(days=21),
        'final_decision': submission_date + timedelta(days=35),
        'publication_deadline': submission_date + timedelta(days=42)
    }
```

#### Conflict Resolution

```python
def detect_proposal_conflicts(proposal_id):
    """
    Detect conflicts between proposals

    Args:
        proposal_id: Proposal to check for conflicts

    Returns:
        list: Conflicting proposals
    """
    proposal = get_proposal(proposal_id)
    all_proposals = get_active_proposals(proposal.agora_id)

    conflicts = []
    for other_proposal in all_proposals:
        if proposal_id != other_proposal.id:
            if check_cia_overlap(proposal, other_proposal):
                conflicts.append(other_proposal)

    return conflicts
```

## Security and Audit Rules

### Authentication Requirements

- **Multi-factor Authentication**: Required for JC members and administrators
- **Session Management**: Automatic timeout after inactivity
- **Access Logging**: Complete audit trail of all access
- **Password Policy**: Strong password requirements

### Data Protection

```python
def apply_data_protection_rules(user_data, purpose):
    """
    Apply GDPR and data protection rules

    Args:
        user_data: Personal data being processed
        purpose: Purpose of data processing

    Returns:
        dict: Protection measures applied
    """
    measures = {
        'encryption': encrypt_sensitive_fields(user_data),
        'access_control': apply_need_to_know(user_data, purpose),
        'retention_period': calculate_retention_period(purpose),
        'anonymization': anonymize_when_possible(user_data, purpose)
    }

    log_data_processing(user_data, purpose, measures)
    return measures
```

### Audit Trail Requirements

```python
def create_audit_entry(action, user_id, resource_id, details):
    """
    Create comprehensive audit trail entry

    Args:
        action: Action performed
        user_id: User performing action
        resource_id: Resource affected
        details: Additional details

    Returns:
        str: Audit entry ID
    """
    audit_entry = {
        'timestamp': datetime.utcnow(),
        'action': action,
        'user_id': user_id,
        'resource_id': resource_id,
        'details': details,
        'ip_address': get_client_ip(),
        'session_id': get_session_id(),
        'hash': calculate_integrity_hash()
    }

    return store_audit_entry(audit_entry)
```

## Performance and Scalability Rules

### Concurrent Access Management

```python
def manage_concurrent_voting(proposal_id, vote_data):
    """
    Handle concurrent vote submissions

    Args:
        proposal_id: Proposal being voted on
        vote_data: Vote submission data

    Returns:
        dict: Processing result
    """
    with voting_lock(proposal_id):
        # Validate vote is still valid
        if not validate_vote_timing(proposal_id):
            return {'success': False, 'reason': 'Voting period ended'}

        # Check for existing vote
        existing_vote = get_existing_vote(vote_data.delegate_id, proposal_id)

        if existing_vote:
            result = update_existing_vote(existing_vote, vote_data)
        else:
            result = create_new_vote(vote_data)

        # Update real-time counts
        update_vote_counts(proposal_id)

    return result
```

### Load Balancing Rules

- **Database Optimization**: Read replicas for reporting queries
- **Caching Strategy**: Cache frequently accessed data
- **Request Throttling**: Rate limiting for API endpoints
- **Geographic Distribution**: CDN for global access

## Compliance and Legal Requirements

### Constitutional Compliance

- All procedures must follow AEGEE constitutional requirements
- Changes require proper constitutional amendment process
- Precedent and historical decisions must be considered
- Legal review required for significant changes

### Data Protection Compliance

- **GDPR Compliance**: Full compliance with European data protection laws
- **Consent Management**: Explicit consent for data processing
- **Right to Deletion**: Ability to delete personal data
- **Data Portability**: Export personal data on request

### Financial Compliance

- Transparent handling of any financial implications
- Proper authorization for expenditures
- Audit trail for financial decisions
- Compliance with organizational financial policies

This comprehensive business rules framework ensures that the AEGEE OMS operates in full compliance with organizational requirements while maintaining democratic principles and legal compliance.
