-- Yuvnix Local Development Seed Data
-- Provides verified baseline residential communities and pickup points

INSERT INTO public.communities (id, name, slug, description, type, college_affiliation, city, state, general_area, is_verified, active_member_count)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'PDEU Hostel Block A',
        'pdeu-hostel-block-a',
        'On-campus boys hostel blocks with high evening delivery volume.',
        'hostel',
        'PDEU Gandhinagar',
        'Gandhinagar',
        'Gujarat',
        'Knowledge Corridor, Raisan',
        true,
        248
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'PDEU Girls Hostel',
        'pdeu-girls-hostel',
        'Girls residential wings with secure gated pickup points.',
        'hostel',
        'PDEU Gandhinagar',
        'Gandhinagar',
        'Gujarat',
        'Knowledge Corridor, Raisan',
        true,
        182
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'Sunrise PG',
        'sunrise-student-pg',
        'Popular off-campus student PG residence near Raysan crossroads.',
        'pg',
        'Nearby Universities (PDEU, NIFT)',
        'Gandhinagar',
        'Gujarat',
        'Raysan Village Road',
        true,
        64
    ),
    (
        '44444444-4444-4444-4444-444444444444',
        'Friends Apartment',
        'friends-student-apartment',
        'Student-shared flat clusters with joint weekend grocery runs.',
        'apartment',
        'Multi-College Students',
        'Gandhinagar',
        'Gujarat',
        'Near Bhaijipura Cross Road, Kudasan',
        true,
        42
    )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    type = EXCLUDED.type,
    college_affiliation = EXCLUDED.college_affiliation,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    general_area = EXCLUDED.general_area,
    is_verified = EXCLUDED.is_verified,
    active_member_count = EXCLUDED.active_member_count;

-- Seed Pickup Points for Communities (Tier 2 Resident-Only Data)
INSERT INTO public.community_pickup_points (community_id, physical_address, delivery_pickup_point, taxi_pickup_point, gate_instructions)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'Knowledge Corridor, Raisan, Gandhinagar 382007',
        'Hostel Gate 1 Main Security Desk',
        'Hostel Circle / Gate 1 Porch',
        'Delivery partners must register at Gate 1'
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'Girls Wing, Campus Block G, Knowledge Corridor, Raisan 382007',
        'Block G Entrance Foyer Security Desk',
        'Girls Hostel Perimeter Gate',
        'Deliveries held at foyer security'
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'Plot 44, Raysan Village Road, Gandhinagar 382007',
        'Building Main Reception / Gate',
        'Sunrise PG Front Parking Bay',
        'Ring warden desk on arrival'
    ),
    (
        '44444444-4444-4444-4444-444444444444',
        'Near Bhaijipura Cross Road, Kudasan, Gandhinagar 382421',
        'Tower A Ground Lobby',
        'Society Entrance Gate',
        'Passcode entry for visitors'
    )
ON CONFLICT (community_id) DO UPDATE
SET physical_address = EXCLUDED.physical_address,
    delivery_pickup_point = EXCLUDED.delivery_pickup_point,
    taxi_pickup_point = EXCLUDED.taxi_pickup_point,
    gate_instructions = EXCLUDED.gate_instructions;
