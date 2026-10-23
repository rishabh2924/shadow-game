export interface StarterGroup {
  name: string;
  description: string;
  pairs: [string, string][];
}

export const STARTER_GROUPS: StarterGroup[] = [
  {
    name: "Animals",
    description: "Look-alike creatures that are easy to confuse.",
    pairs: [
      ["Cat", "Dog"], ["Lion", "Tiger"], ["Dolphin", "Whale"], ["Rabbit", "Hare"], ["Crocodile", "Alligator"],
      ["Horse", "Donkey"], ["Sheep", "Goat"], ["Frog", "Toad"], ["Butterfly", "Moth"], ["Bee", "Wasp"],
      ["Eagle", "Hawk"], ["Crow", "Raven"], ["Leopard", "Cheetah"], ["Camel", "Llama"], ["Owl", "Bat"],
      ["Mouse", "Rat"], ["Seal", "Sea Lion"], ["Turtle", "Tortoise"], ["Monkey", "Gorilla"], ["Duck", "Goose"],
      ["Elephant", "Rhinoceros"],
    ],
  },
  {
    name: "Food and Drinks",
    description: "Things you eat and drink every day.",
    pairs: [
      ["Coffee", "Tea"], ["Pizza", "Burger"], ["Pancake", "Waffle"], ["Mango", "Papaya"], ["Pasta", "Noodles"],
      ["Butter", "Margarine"], ["Milk", "Yogurt"], ["Juice", "Smoothie"], ["Cake", "Pie"], ["Cookie", "Biscuit"],
      ["Chocolate", "Caramel"], ["Rice", "Couscous"], ["Soup", "Stew"], ["Sandwich", "Wrap"], ["Ice Cream", "Gelato"],
      ["Beer", "Wine"], ["Lemon", "Lime"], ["Honey", "Jam"], ["Croissant", "Bagel"], ["Sushi", "Sashimi"],
      ["Apple", "Pear"],
    ],
  },
  {
    name: "Movies and TV",
    description: "Screens, stories and the people behind them.",
    pairs: [
      ["Batman", "Superman"], ["Titanic", "Avatar"], ["Harry Potter", "Lord of the Rings"], ["Star Wars", "Star Trek"],
      ["Friends", "Seinfeld"], ["Hero", "Villain"], ["Comedy", "Drama"], ["Cinema", "Theatre"], ["Actor", "Director"],
      ["Sitcom", "Soap Opera"], ["Trailer", "Teaser"], ["Sequel", "Prequel"], ["Oscar", "Grammy"], ["Netflix", "YouTube"],
      ["Documentary", "Biopic"], ["Popcorn", "Nachos"], ["Cartoon", "Anime"], ["Thriller", "Horror"],
      ["Subtitles", "Dubbing"], ["Bollywood", "Hollywood"],
    ],
  },
  {
    name: "Sports",
    description: "Games, athletes and arenas.",
    pairs: [
      ["Football", "Rugby"], ["Cricket", "Baseball"], ["Tennis", "Badminton"], ["Basketball", "Volleyball"],
      ["Boxing", "Wrestling"], ["Swimming", "Diving"], ["Golf", "Mini Golf"], ["Hockey", "Ice Hockey"],
      ["Skiing", "Snowboarding"], ["Marathon", "Sprint"], ["Archery", "Shooting"], ["Cycling", "Motorcycling"],
      ["Surfing", "Skateboarding"], ["Table Tennis", "Squash"], ["Judo", "Karate"], ["Gymnastics", "Yoga"],
      ["Chess", "Checkers"], ["Referee", "Umpire"], ["Stadium", "Arena"], ["Olympics", "World Cup"],
      ["Rowing", "Sailing"],
    ],
  },
  {
    name: "Countries and Cities",
    description: "Places that people often compare.",
    pairs: [
      ["India", "Pakistan"], ["Paris", "London"], ["Japan", "China"], ["Australia", "New Zealand"], ["Spain", "Portugal"],
      ["Sweden", "Norway"], ["Dubai", "Abu Dhabi"], ["Mumbai", "Delhi"], ["New York", "Los Angeles"], ["Rome", "Athens"],
      ["Brazil", "Argentina"], ["Egypt", "Morocco"], ["Thailand", "Vietnam"], ["Switzerland", "Austria"],
      ["Netherlands", "Belgium"], ["Singapore", "Hong Kong"], ["Tokyo", "Seoul"], ["Berlin", "Vienna"],
      ["Venice", "Amsterdam"], ["Istanbul", "Cairo"], ["Bangkok", "Jakarta"],
    ],
  },
  {
    name: "Technology",
    description: "Gadgets, apps and the internet.",
    pairs: [
      ["Laptop", "Tablet"], ["iPhone", "Android"], ["Facebook", "Instagram"], ["WhatsApp", "Telegram"], ["Google", "Bing"],
      ["Windows", "Linux"], ["Wi-Fi", "Bluetooth"], ["Keyboard", "Mouse"], ["Printer", "Scanner"],
      ["Email", "Text Message"], ["Python", "Java"], ["Robot", "Drone"], ["Camera", "Webcam"],
      ["Headphones", "Earbuds"], ["Smartwatch", "Fitness Band"], ["Zoom", "Skype"], ["Amazon", "Flipkart"],
      ["Cloud", "Server"], ["Monitor", "Projector"], ["USB", "HDMI"], ["Podcast", "Radio"], ["Virus", "Spyware"],
    ],
  },
  {
    name: "Everyday Objects",
    description: "Stuff around the house.",
    pairs: [
      ["Spoon", "Fork"], ["Pen", "Pencil"], ["Chair", "Stool"], ["Sofa", "Armchair"], ["Cup", "Mug"],
      ["Plate", "Bowl"], ["Knife", "Scissors"], ["Towel", "Napkin"], ["Pillow", "Cushion"], ["Blanket", "Quilt"],
      ["Umbrella", "Raincoat"], ["Backpack", "Suitcase"], ["Candle", "Lamp"], ["Mirror", "Window"], ["Key", "Lock"],
      ["Clock", "Watch"], ["Broom", "Mop"], ["Soap", "Shampoo"], ["Toothbrush", "Comb"], ["Wallet", "Purse"],
      ["Hammer", "Screwdriver"], ["Bucket", "Basin"],
    ],
  },
  {
    name: "Nature",
    description: "Landscapes, weather and the sky.",
    pairs: [
      ["River", "Stream"], ["Mountain", "Hill"], ["Lake", "Pond"], ["Forest", "Jungle"], ["Desert", "Beach"],
      ["Ocean", "Sea"], ["Rain", "Drizzle"], ["Thunder", "Lightning"], ["Snow", "Hail"], ["Volcano", "Earthquake"],
      ["Rose", "Lotus"], ["Sun", "Moon"], ["Star", "Planet"], ["Cave", "Canyon"], ["Waterfall", "Geyser"],
      ["Island", "Peninsula"], ["Cloud", "Fog"], ["Tree", "Bush"], ["Grass", "Moss"], ["Sunrise", "Sunset"],
      ["Tornado", "Hurricane"], ["Glacier", "Iceberg"],
    ],
  },
  {
    name: "Professions",
    description: "Jobs that sound alike on the surface.",
    pairs: [
      ["Doctor", "Nurse"], ["Teacher", "Professor"], ["Chef", "Waiter"], ["Pilot", "Astronaut"], ["Lawyer", "Judge"],
      ["Police Officer", "Detective"], ["Firefighter", "Paramedic"], ["Engineer", "Architect"], ["Farmer", "Gardener"],
      ["Singer", "Dancer"], ["Painter", "Sculptor"], ["Journalist", "Author"], ["Banker", "Accountant"],
      ["Plumber", "Electrician"], ["Carpenter", "Mason"], ["Barber", "Tailor"], ["Driver", "Conductor"],
      ["Dentist", "Surgeon"], ["Scientist", "Inventor"], ["Soldier", "Sailor"], ["Librarian", "Editor"],
      ["Mechanic", "Technician"],
    ],
  },
  {
    name: "Indian Culture",
    description: "Festivals, food, clothes and traditions.",
    pairs: [
      ["Diwali", "Holi"], ["Samosa", "Pakora"], ["Biryani", "Pulao"], ["Sari", "Lehenga"], ["Kurta", "Sherwani"],
      ["Yoga", "Meditation"], ["Dosa", "Idli"], ["Chai", "Lassi"], ["Rangoli", "Mehndi"], ["Sitar", "Tabla"],
      ["Bharatanatyam", "Kathak"], ["Ramayana", "Mahabharata"], ["Taj Mahal", "Red Fort"], ["Ganga", "Yamuna"],
      ["Cricket", "Kabaddi"], ["Naan", "Roti"], ["Jalebi", "Gulab Jamun"], ["Dal", "Rajma"], ["Pongal", "Onam"],
      ["Kashmir", "Kerala"], ["Rickshaw", "Tonga"], ["Himalayas", "Western Ghats"],
    ],
  },
];
