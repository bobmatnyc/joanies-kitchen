/**
 * Generate 2000 Diverse User Profiles
 *
 * Creates realistic user profiles with:
 * - Diverse demographics (age, race, location)
 * - Authentic backstories
 * - Varied cooking interests and skill levels
 * - Distribution across US and Canadian cities
 *
 * Output: JSON file with all profile data for insertion
 */

import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// ============================================================================
// DEMOGRAPHIC DATA
// ============================================================================

const FIRST_NAMES = {
  // Anglo-American
  american: [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
    'William', 'Barbara', 'David', 'Elizabeth', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
    'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
    'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  ],
  // Hispanic/Latino
  hispanic: [
    'Jose', 'Maria', 'Juan', 'Guadalupe', 'Luis', 'Carmen', 'Carlos', 'Rosa',
    'Miguel', 'Ana', 'Pedro', 'Isabel', 'Jorge', 'Laura', 'Francisco', 'Sofia',
    'Ricardo', 'Elena', 'Antonio', 'Lucia', 'Fernando', 'Gabriela', 'Diego', 'Valentina',
    'Rafael', 'Mariana', 'Eduardo', 'Adriana', 'Roberto', 'Daniela', 'Alejandro', 'Camila',
  ],
  // Asian (East, South, Southeast)
  asian: [
    'Wei', 'Mei', 'Raj', 'Priya', 'Haruto', 'Sakura', 'Min-jun', 'Ji-woo',
    'Arjun', 'Ananya', 'Chen', 'Ying', 'Hiroshi', 'Yuki', 'Anh', 'Linh',
    'Kumar', 'Lakshmi', 'Jin', 'Xiu', 'Kenji', 'Hana', 'Thao', 'Minh',
    'Amit', 'Neha', 'Jian', 'Fang', 'Taro', 'Aiko', 'Vinh', 'Mai',
  ],
  // African-American
  african_american: [
    'Jamal', 'Keisha', 'DeShawn', 'Latoya', 'Marcus', 'Tanisha', 'Tyrone', 'Aaliyah',
    'Malcolm', 'Jasmine', 'Andre', 'Shanice', 'Terrell', 'Monique', 'Isaiah', 'Ebony',
    'Malik', 'Tiffany', 'Darius', 'Gabrielle', 'Kareem', 'Naomi', 'Xavier', 'Imani',
  ],
  // Middle Eastern/Arab
  middle_eastern: [
    'Omar', 'Fatima', 'Ali', 'Zahra', 'Hassan', 'Amira', 'Ahmed', 'Layla',
    'Yusuf', 'Nour', 'Mohammed', 'Yasmin', 'Karim', 'Mariam', 'Tariq', 'Zainab',
  ],
  // European (non-Anglo)
  european: [
    'Luca', 'Sofia', 'Matteo', 'Emma', 'Lars', 'Astrid', 'Dmitri', 'Olga',
    'Pierre', 'Marie', 'Hans', 'Greta', 'Marco', 'Giulia', 'Franz', 'Katrin',
  ],
  // Indigenous/Native American
  indigenous: [
    'Kai', 'Aiyana', 'Takoda', 'Nokomis', 'Kohana', 'Winona', 'Chayton', 'Kaya',
  ],
};

const LAST_NAMES = {
  american: [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
    'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
    'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  ],
  hispanic: [
    'Hernandez', 'Lopez', 'Garcia', 'Martinez', 'Gonzalez', 'Rodriguez', 'Perez', 'Sanchez',
    'Ramirez', 'Torres', 'Rivera', 'Gomez', 'Diaz', 'Reyes', 'Cruz', 'Morales',
    'Gutierrez', 'Ortiz', 'Ruiz', 'Alvarez', 'Castillo', 'Jimenez', 'Vargas', 'Romero',
  ],
  asian: [
    'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Patel',
    'Kumar', 'Singh', 'Nguyen', 'Tran', 'Kim', 'Park', 'Lee', 'Tanaka',
    'Sato', 'Suzuki', 'Takahashi', 'Watanabe', 'Choi', 'Yoon', 'Jang', 'Kang',
  ],
  african_american: [
    'Washington', 'Jefferson', 'Madison', 'Jackson', 'Franklin', 'Coleman', 'Harper', 'Woods',
    'Boyd', 'Hayes', 'Bryant', 'Alexander', 'Russell', 'Griffin', 'Diaz', 'Hayes',
  ],
  middle_eastern: [
    'Hassan', 'Ali', 'Ahmed', 'Ibrahim', 'Mohamed', 'Mahmoud', 'Rashid', 'Khalil',
    'Nasser', 'Farah', 'Saleh', 'Mansour', 'Abbas', 'Aziz', 'Haddad', 'Khoury',
  ],
  european: [
    'Rossi', 'Ferrari', 'Esposito', 'Bianchi', 'Schmidt', 'Müller', 'Weber', 'Meyer',
    'Dupont', 'Bernard', 'Dubois', 'Martin', 'Ivanov', 'Petrov', 'Sokolov', 'Novak',
  ],
  indigenous: [
    'Blackfeather', 'Redcloud', 'Running Bear', 'White Eagle', 'Lone Wolf', 'Swift Horse',
  ],
};

const CITIES_US = [
  { name: 'New York, NY', timezone: 'America/New_York' },
  { name: 'Los Angeles, CA', timezone: 'America/Los_Angeles' },
  { name: 'Chicago, IL', timezone: 'America/Chicago' },
  { name: 'Houston, TX', timezone: 'America/Chicago' },
  { name: 'Phoenix, AZ', timezone: 'America/Phoenix' },
  { name: 'Philadelphia, PA', timezone: 'America/New_York' },
  { name: 'San Antonio, TX', timezone: 'America/Chicago' },
  { name: 'San Diego, CA', timezone: 'America/Los_Angeles' },
  { name: 'Dallas, TX', timezone: 'America/Chicago' },
  { name: 'San Jose, CA', timezone: 'America/Los_Angeles' },
  { name: 'Austin, TX', timezone: 'America/Chicago' },
  { name: 'Jacksonville, FL', timezone: 'America/New_York' },
  { name: 'Fort Worth, TX', timezone: 'America/Chicago' },
  { name: 'Columbus, OH', timezone: 'America/New_York' },
  { name: 'Charlotte, NC', timezone: 'America/New_York' },
  { name: 'San Francisco, CA', timezone: 'America/Los_Angeles' },
  { name: 'Indianapolis, IN', timezone: 'America/Indiana/Indianapolis' },
  { name: 'Seattle, WA', timezone: 'America/Los_Angeles' },
  { name: 'Denver, CO', timezone: 'America/Denver' },
  { name: 'Boston, MA', timezone: 'America/New_York' },
  { name: 'Portland, OR', timezone: 'America/Los_Angeles' },
  { name: 'Nashville, TN', timezone: 'America/Chicago' },
  { name: 'Atlanta, GA', timezone: 'America/New_York' },
  { name: 'Miami, FL', timezone: 'America/New_York' },
  { name: 'New Orleans, LA', timezone: 'America/Chicago' },
  { name: 'Minneapolis, MN', timezone: 'America/Chicago' },
  { name: 'Tampa, FL', timezone: 'America/New_York' },
  { name: 'Raleigh, NC', timezone: 'America/New_York' },
  { name: 'Omaha, NE', timezone: 'America/Chicago' },
  { name: 'Louisville, KY', timezone: 'America/Kentucky/Louisville' },
];

const CITIES_CANADA = [
  { name: 'Toronto, ON', timezone: 'America/Toronto' },
  { name: 'Montreal, QC', timezone: 'America/Montreal' },
  { name: 'Vancouver, BC', timezone: 'America/Vancouver' },
  { name: 'Calgary, AB', timezone: 'America/Edmonton' },
  { name: 'Edmonton, AB', timezone: 'America/Edmonton' },
  { name: 'Ottawa, ON', timezone: 'America/Toronto' },
  { name: 'Winnipeg, MB', timezone: 'America/Winnipeg' },
  { name: 'Quebec City, QC', timezone: 'America/Montreal' },
  { name: 'Hamilton, ON', timezone: 'America/Toronto' },
  { name: 'Halifax, NS', timezone: 'America/Halifax' },
];

// ============================================================================
// COOKING INTERESTS & SPECIALTIES
// ============================================================================

const CUISINES = [
  'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai', 'Indian', 'French',
  'Mediterranean', 'American', 'Korean', 'Vietnamese', 'Greek', 'Spanish',
  'Middle Eastern', 'Caribbean', 'Brazilian', 'Ethiopian', 'Moroccan',
  'German', 'British', 'Southern', 'Tex-Mex', 'Cajun', 'Soul Food',
];

const COOKING_STYLES = [
  'Baking', 'Grilling', 'Slow Cooking', 'Pressure Cooking', 'Fermentation',
  'Smoking', 'Canning', 'Meal Prep', 'One-Pot Meals', 'Quick & Easy',
  'Gourmet', 'Farm-to-Table', 'Comfort Food', 'Health-Conscious', 'Vegan',
  'Vegetarian', 'Gluten-Free', 'Keto', 'Paleo', 'Low-Carb',
];

const PROFESSIONS = [
  'Software Engineer', 'Teacher', 'Nurse', 'Accountant', 'Marketing Manager',
  'Chef', 'Graphic Designer', 'Project Manager', 'Sales Representative', 'Writer',
  'Pharmacist', 'Attorney', 'Physical Therapist', 'Real Estate Agent', 'Engineer',
  'Financial Analyst', 'Social Worker', 'Architect', 'Dentist', 'Veterinarian',
  'Electrician', 'Plumber', 'Construction Manager', 'IT Consultant', 'Data Scientist',
  'Product Manager', 'UX Designer', 'Mechanic', 'Photographer', 'Journalist',
  'Librarian', 'Police Officer', 'Firefighter', 'Paramedic', 'Pilot',
  'Retail Manager', 'Restaurant Manager', 'Event Planner', 'Interior Designer', 'Florist',
  'Retired', 'Student', 'Stay-at-home Parent', 'Freelancer', 'Small Business Owner',
];

const HOBBIES = [
  'gardening', 'reading', 'hiking', 'yoga', 'photography', 'travel',
  'wine tasting', 'craft beer', 'music', 'painting', 'pottery',
  'knitting', 'woodworking', 'cycling', 'running', 'swimming',
  'video games', 'board games', 'volunteering', 'blogging', 'podcasting',
];

// ============================================================================
// BIO TEMPLATES
// ============================================================================

const BIO_TEMPLATES = [
  // Professional cooks
  (p: any) => `Professional ${p.profession.toLowerCase()} with a passion for ${p.specialty1}. ${p.cookingLevel === 'expert' ? 'Love experimenting with new techniques and flavors' : 'Always learning new recipes'}. Based in ${p.location}.`,

  // Home cooks with heritage
  (p: any) => `Home cook from ${p.location}. ${p.specialty1} recipes passed down from my ${['grandmother', 'mother', 'family'][randomInt(3)]}. ${p.hobby ? `When I'm not cooking, I enjoy ${p.hobby}` : 'Love sharing my favorite family recipes'}.`,

  // Food enthusiasts
  (p: any) => `${p.profession} by day, passionate cook by night! Specializing in ${p.specialty1} and ${p.specialty2}. ${p.age > 50 ? 'Cooking for over 30 years' : 'Always experimenting with new flavors'}.`,

  // Health-focused
  (p: any) => `${p.location}-based ${p.profession.toLowerCase()}. Focused on ${p.specialty1} and healthy eating. ${p.hobby ? `Love ${p.hobby} and ` : ''}Creating nutritious meals that taste amazing!`,

  // Adventurous cooks
  (p: any) => `Food adventurer exploring ${p.specialty1} and ${p.specialty2}. ${p.profession} in ${p.location}. ${['Love', 'Obsessed with', 'Can\'t get enough of'][randomInt(3)]} trying new recipes and techniques!`,

  // Simple & relatable
  (p: any) => `Just a ${p.profession.toLowerCase()} who loves to cook! Specializing in ${p.specialty1}. ${p.location} local. ${p.hobby ? `Also into ${p.hobby}` : 'Always looking for new recipe ideas'}.`,

  // Family-oriented
  (p: any) => `${p.profession} and parent cooking for my family in ${p.location}. Love making ${p.specialty1} and ${p.specialty2}. ${['Kids approve most of my recipes!', 'Family dinners are my favorite', 'Cooking brings us together'][randomInt(3)]}`,

  // Minimalist
  (p: any) => `${p.specialty1} enthusiast. ${p.location}.`,

  // Detailed
  (p: any) => `${p.profession} living in ${p.location}. Been cooking for ${p.age > 40 ? 'over 20 years' : p.age > 30 ? 'about 10 years' : 'several years'}. My specialties are ${p.specialty1} and ${p.specialty2}. ${p.hobby ? `In my free time, I enjoy ${p.hobby}. ` : ''}${['Always happy to share recipes and tips!', 'Love connecting with other food lovers!', 'Cooking is my creative outlet!'][randomInt(3)]}`,
];

// ============================================================================
// COMMENT TEMPLATES
// ============================================================================

const COMMENT_TEMPLATES = [
  // Enthusiastic
  'This recipe is amazing! Made it exactly as written and it turned out perfectly. My family loved it!',
  'Absolutely delicious! This is going in my regular rotation. Thanks for sharing!',
  'Perfect! Made this for dinner tonight and everyone asked for seconds. Will definitely make again!',
  'Outstanding recipe! The flavors were incredible. This is a keeper!',
  'Wow, just wow! Best version of this dish I\'ve ever made. Thank you!',

  // With modifications
  'Great recipe! I added a bit of garlic and it was perfect.',
  'Made this with a few tweaks - used honey instead of sugar. Turned out great!',
  'Good recipe. I cut the salt in half and it was still plenty flavorful.',
  'Delicious! I doubled the spices for extra flavor. Highly recommend!',
  'Really good! I substituted vegetable broth and it worked beautifully.',

  // Timing/temp adjustments
  'Excellent recipe! Note: my oven runs hot so I reduced temp by 25°F.',
  'Perfect! Just needed an extra 10 minutes of cooking time in my oven.',
  'Great recipe. Cut the cooking time by 5 minutes and it was perfect.',
  'Made this but reduced cooking time slightly - turned out great!',

  // Simple praise
  'Perfect! ⭐⭐⭐⭐⭐',
  'So good! Made it twice this week already.',
  'Delicious!',
  'Easy and tasty! Exactly what I was looking for.',
  'Amazing! Will be making this regularly.',
  'Yum! The whole family enjoyed this.',

  // Constructive feedback
  'Good recipe overall. A bit too salty for my taste but I\'ll adjust next time.',
  'Pretty good! I think it could use a bit more seasoning.',
  'Decent recipe. Turned out well but not quite what I expected.',
  'Good, but I prefer more spice. Will add extra next time.',

  // Detailed reviews
  'Made this for a dinner party and it was a huge hit! Easy to follow instructions and great results. I prep everything ahead of time which made it even easier.',
  'This has become my go-to recipe! I\'ve made it at least a dozen times. The key is not to rush the cooking process - let everything develop flavor.',
  'Fantastic recipe! Very forgiving - I\'ve made small substitutions each time and it always works. My kids even eat their vegetables when I make this!',
  'Love this recipe! Clear instructions and common ingredients. Perfect for weeknight dinners. I usually make extra to have leftovers.',

  // Beginner-friendly
  'First time making this dish and it turned out great! Very easy to follow.',
  'As a beginner cook, I appreciated how clear the instructions were. Turned out perfect!',
  'Easy recipe for someone like me who doesn\'t cook much. Came out great!',

  // Special occasions
  'Made this for Thanksgiving and it was perfect! Will be my new go-to.',
  'Great for meal prep! I make a big batch on Sundays.',
  'Perfect for potlucks - always gets compliments!',
  'Made this for Christmas dinner. Everyone raved about it!',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function randomChoice<T>(array: T[]): T {
  return array[randomInt(array.length)];
}

function randomChoices<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateUsername(firstName: string, lastName: string, existingUsernames: Set<string>): string {
  // Try different username patterns
  const patterns = [
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}${randomInt(100)}`,
    `${lastName.toLowerCase()}${firstName.toLowerCase()}`,
    `chef_${firstName.toLowerCase()}`,
    `${firstName.toLowerCase()}_cooks`,
    `${firstName.toLowerCase()}_kitchen`,
  ];

  for (const pattern of patterns) {
    const username = pattern.replace(/[^a-z0-9_-]/g, '');
    if (!existingUsernames.has(username) && username.length >= 3 && username.length <= 30) {
      existingUsernames.add(username);
      return username;
    }
  }

  // Fallback: add random numbers
  let counter = 1;
  while (true) {
    const username = `${firstName.toLowerCase()}${counter}`;
    if (!existingUsernames.has(username)) {
      existingUsernames.add(username);
      return username;
    }
    counter++;
  }
}

function generateAge(): number {
  // Age distribution: 18-85 with realistic bell curve
  // Most users 25-55, fewer young and elderly
  const rand = Math.random();
  if (rand < 0.10) return 18 + randomInt(7);  // 18-24 (10%)
  if (rand < 0.40) return 25 + randomInt(10); // 25-34 (30%)
  if (rand < 0.70) return 35 + randomInt(10); // 35-44 (30%)
  if (rand < 0.90) return 45 + randomInt(15); // 45-59 (20%)
  return 60 + randomInt(26); // 60-85 (10%)
}

function getCookingLevel(age: number): string {
  // Cooking skill generally increases with age
  const rand = Math.random();
  if (age < 25) {
    if (rand < 0.60) return 'beginner';
    if (rand < 0.90) return 'intermediate';
    return 'advanced';
  } else if (age < 40) {
    if (rand < 0.30) return 'beginner';
    if (rand < 0.70) return 'intermediate';
    return 'advanced';
  } else if (age < 60) {
    if (rand < 0.15) return 'beginner';
    if (rand < 0.50) return 'intermediate';
    if (rand < 0.85) return 'advanced';
    return 'expert';
  } else {
    if (rand < 0.10) return 'beginner';
    if (rand < 0.35) return 'intermediate';
    if (rand < 0.75) return 'advanced';
    return 'expert';
  }
}

function getActivityLevel(): string {
  const rand = Math.random();
  if (rand < 0.20) return 'lurker';      // 20% - 0-5 interactions
  if (rand < 0.60) return 'occasional';  // 40% - 5-15 interactions
  if (rand < 0.90) return 'regular';     // 30% - 20-50 interactions
  return 'power';                        // 10% - 100+ interactions
}

// ============================================================================
// PROFILE GENERATION
// ============================================================================

interface SyntheticUserProfile {
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  location: string;
  specialties: string[];
  profile_image_url: string | null;
  is_public: boolean;
  is_synthetic_user: boolean;
  synthetic_user_active: boolean;
  synthetic_activity_level: string;
  created_at: Date;

  // Metadata (not stored in DB, used for activity generation)
  _metadata: {
    age: number;
    cookingLevel: string;
    profession: string;
    ethnicity: string;
    hobby: string;
  };
}

function generateProfiles(count: number): SyntheticUserProfile[] {
  console.log(`🎭 Generating ${count} diverse user profiles...\n`);

  const profiles: SyntheticUserProfile[] = [];
  const existingUsernames = new Set<string>();

  // Ethnicity distribution (roughly representative of US/Canada)
  const ethnicityDistribution = [
    { group: 'american', weight: 50 },       // 50%
    { group: 'hispanic', weight: 20 },       // 20%
    { group: 'african_american', weight: 13 }, // 13%
    { group: 'asian', weight: 10 },          // 10%
    { group: 'european', weight: 5 },        // 5%
    { group: 'middle_eastern', weight: 1.5 }, // 1.5%
    { group: 'indigenous', weight: 0.5 },    // 0.5%
  ];

  // Create cumulative distribution
  let cumulative = 0;
  const cumulativeDistribution = ethnicityDistribution.map(e => {
    cumulative += e.weight;
    return { group: e.group, threshold: cumulative };
  });

  for (let i = 0; i < count; i++) {
    // Select ethnicity based on distribution
    const rand = Math.random() * 100;
    const ethnicity = cumulativeDistribution.find(e => rand <= e.threshold)!.group;

    // Generate name based on ethnicity
    const firstName = randomChoice(FIRST_NAMES[ethnicity as keyof typeof FIRST_NAMES]);
    const lastName = randomChoice(LAST_NAMES[ethnicity as keyof typeof LAST_NAMES]);
    const displayName = `${firstName} ${lastName}`;

    // Generate username
    const username = generateUsername(firstName, lastName, existingUsernames);

    // Generate age and derived attributes
    const age = generateAge();
    const cookingLevel = getCookingLevel(age);
    const activityLevel = getActivityLevel();

    // Select location (80% US, 20% Canada)
    const location = Math.random() < 0.8 ? randomChoice(CITIES_US) : randomChoice(CITIES_CANADA);

    // Select specialties (1-3 cuisines/styles)
    const specialtyCount = randomInt(3) + 1; // 1-3 specialties
    const allSpecialties = [...CUISINES, ...COOKING_STYLES];
    const specialties = randomChoices(allSpecialties, specialtyCount);

    // Select profession and hobby
    const profession = randomChoice(PROFESSIONS);
    const hobby = Math.random() < 0.7 ? randomChoice(HOBBIES) : '';

    // Generate bio
    const bioTemplate = randomChoice(BIO_TEMPLATES);
    const bioData = {
      location: location.name,
      specialty1: specialties[0],
      specialty2: specialties[1] || randomChoice(allSpecialties),
      profession,
      cookingLevel,
      age,
      hobby,
    };
    const bio = bioTemplate(bioData);

    // Generate join date (spread over last 2 years)
    const daysAgo = randomInt(730); // 0-730 days ago
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    // Avatar URL (placeholder - will be replaced with actual images)
    const avatarNumber = (i % 100) + 1; // Cycle through 100 avatar slots
    const profileImageUrl = `/avatars/synthetic/user-${avatarNumber.toString().padStart(3, '0')}.jpg`;

    const profile: SyntheticUserProfile = {
      user_id: randomUUID(),
      username,
      display_name: displayName,
      bio,
      location: location.name,
      specialties,
      profile_image_url: profileImageUrl,
      is_public: true,
      is_synthetic_user: true,
      synthetic_user_active: true,
      synthetic_activity_level: activityLevel,
      created_at: createdAt,
      _metadata: {
        age,
        cookingLevel,
        profession,
        ethnicity,
        hobby,
      },
    };

    profiles.push(profile);

    if ((i + 1) % 100 === 0) {
      console.log(`✅ Generated ${i + 1} profiles...`);
    }
  }

  console.log(`\n✨ Successfully generated ${count} profiles!`);
  console.log(`\n📊 Distribution:`);
  console.log(`   Activity: ${profiles.filter(p => p.synthetic_activity_level === 'lurker').length} lurkers, ${profiles.filter(p => p.synthetic_activity_level === 'occasional').length} occasional, ${profiles.filter(p => p.synthetic_activity_level === 'regular').length} regular, ${profiles.filter(p => p.synthetic_activity_level === 'power').length} power users`);
  console.log(`   Locations: ${profiles.filter(p => p.location.includes('CA')).length} California, ${profiles.filter(p => p.location.includes('NY')).length} New York, ${profiles.filter(p => p.location.includes('TX')).length} Texas`);

  return profiles;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

const profiles = generateProfiles(2000);

// Write to JSON file
const outputPath = 'scripts/seed-users/generated-profiles.json';
writeFileSync(outputPath, JSON.stringify(profiles, null, 2));

console.log(`\n💾 Saved profiles to: ${outputPath}`);
console.log(`\nNext steps:`);
console.log(`  1. Run migration: pnpm tsx scripts/seed-users/00-migration-synthetic-users.ts`);
console.log(`  2. Insert profiles: pnpm tsx scripts/seed-users/02-insert-profiles.ts`);
console.log(`  3. Generate activity: pnpm tsx scripts/seed-users/03-generate-activity.ts`);

// Export for use in other scripts
export { profiles, COMMENT_TEMPLATES };
export type { SyntheticUserProfile };
