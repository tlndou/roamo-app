"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddSpotDialog } from "@/components/add-spot-dialog"
import { ListView } from "@/components/list-view"
import { MapView } from "@/components/map-view"
import { ViewToggle } from "@/components/view-toggle"
import { CategoryFilter } from "@/components/category-filter"
import type { Spot } from "@/types/spot"

const SEED_DATA: Spot[] = [
  {
    id: "1",
    category: "restaurant",
    name: "Moeder",
    city: "Amsterdam",
    country: "Netherlands",
    continent: "Europe",
    comments: "Order the soup",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/cozy-dutch-restaurant-interior.jpg",
    link: "https://www.restaurantmoeder.nl/",
    coordinates: { lat: 52.3676, lng: 4.8936 },
  },
  {
    id: "2",
    category: "restaurant",
    name: "Le Comptoir du Relais",
    city: "Paris",
    country: "France",
    continent: "Europe",
    comments: "Amazing steak frites, reserve ahead",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/parisian-bistro.jpg",
    link: "https://www.hotel-paris-relais-saint-germain.com/",
    coordinates: { lat: 48.8529, lng: 2.3388 },
  },
  {
    id: "3",
    category: "museum",
    name: "Rijksmuseum",
    city: "Amsterdam",
    country: "Netherlands",
    continent: "Europe",
    comments: "Don't miss The Night Watch",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/rijksmuseum-exterior.jpg",
    link: "https://www.rijksmuseum.nl/",
    coordinates: { lat: 52.36, lng: 4.8852 },
  },
  {
    id: "4",
    category: "bar",
    name: "Tales & Spirits",
    city: "Amsterdam",
    country: "Netherlands",
    continent: "Europe",
    comments: "Best cocktails in the city",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/modern-cocktail-bar.jpg",
    link: "https://talesandspirits.com/",
    coordinates: { lat: 52.374, lng: 4.8897 },
  },
  {
    id: "5",
    category: "restaurant",
    name: "Sukiyabashi Jiro",
    city: "Tokyo",
    country: "Japan",
    continent: "Asia",
    comments: "The legendary sushi place, book months ahead",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/tokyo-sushi-counter.jpg",
    link: "https://www.sushi-jiro.jp/",
    coordinates: { lat: 35.6675, lng: 139.7632 },
  },
  {
    id: "6",
    category: "attraction",
    name: "Fushimi Inari Shrine",
    city: "Kyoto",
    country: "Japan",
    continent: "Asia",
    comments: "Go early morning to avoid crowds",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/fushimi-inari-torii-gates.jpg",
    link: "http://inari.jp/en/",
    coordinates: { lat: 34.9671, lng: 135.7727 },
  },
  {
    id: "7",
    category: "restaurant",
    name: "Osteria Francescana",
    city: "Modena",
    country: "Italy",
    continent: "Europe",
    comments: "3 Michelin stars, worth the splurge",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/fine-dining-italian-restaurant.jpg",
    link: "https://www.osteriafrancescana.it/",
    coordinates: { lat: 44.6471, lng: 10.9252 },
  },
  {
    id: "8",
    category: "cafe",
    name: "Blue Bottle Coffee",
    city: "San Francisco",
    country: "United States",
    continent: "North America",
    comments: "Get the New Orleans iced coffee",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/modern-coffee-shop.png",
    link: "https://bluebottlecoffee.com/",
    coordinates: { lat: 37.7749, lng: -122.4194 },
  },
  {
    id: "9",
    category: "attraction",
    name: "Antelope Canyon",
    city: "Page",
    country: "United States",
    continent: "North America",
    comments: "Book a photography tour for best light",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/antelope-canyon-light-beams.jpg",
    coordinates: { lat: 36.8619, lng: -111.3743 },
  },
  {
    id: "10",
    category: "restaurant",
    name: "Quintonil",
    city: "Mexico City",
    country: "Mexico",
    continent: "North America",
    comments: "Modern Mexican cuisine, incredible flavors",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/upscale-mexican-restaurant.jpg",
    link: "https://www.quintonil.com/",
    coordinates: { lat: 19.4326, lng: -99.1332 },
  },
  {
    id: "11",
    category: "bar",
    name: "Employees Only",
    city: "New York",
    country: "United States",
    continent: "North America",
    comments: "Speakeasy vibes, amazing bartenders",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/speakeasy-bar-interior.jpg",
    link: "https://employeesonlynyc.com/",
    coordinates: { lat: 40.7331, lng: -74.002 },
  },
  {
    id: "12",
    category: "attraction",
    name: "Christ the Redeemer",
    city: "Rio de Janeiro",
    country: "Brazil",
    continent: "South America",
    comments: "Go at sunset for amazing views",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/christ-the-redeemer-statue-sunset.jpg",
    link: "https://sagradafamilia.org/",
    coordinates: { lat: -22.9519, lng: -43.2105 },
  },
  {
    id: "13",
    category: "museum",
    name: "Louvre",
    city: "Paris",
    country: "France",
    continent: "Europe",
    comments: "Get there right at opening, go to Mona Lisa first",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/louvre-pyramid.jpg",
    link: "https://www.louvre.fr/",
    coordinates: { lat: 48.8606, lng: 2.3376 },
  },
  {
    id: "14",
    category: "attraction",
    name: "Sagrada Familia",
    city: "Barcelona",
    country: "Spain",
    continent: "Europe",
    comments: "Book tickets online in advance",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/sagrada-familia-interior.jpg",
    link: "https://sagradafamilia.org/",
    coordinates: { lat: 41.4036, lng: 2.1744 },
  },
  {
    id: "15",
    category: "cafe",
    name: "Federal Cafe",
    city: "Barcelona",
    country: "Spain",
    continent: "Europe",
    comments: "Best brunch spot, get the avocado toast",
    useCustomImage: false,
    iconColor: "grey" as const,
    customImage: "/modern-brunch-cafe.jpg",
    coordinates: { lat: 41.3874, lng: 2.1686 },
  },
]

interface NavigationState {
  level: "continent" | "country" | "city" | "spots"
  continent?: string
  country?: string
  city?: string
}

export default function Home() {
  const [spots, setSpots] = useState<Spot[]>(SEED_DATA)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [view, setView] = useState<"list" | "map">("list")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [navigation, setNavigation] = useState<NavigationState>({ level: "continent" })

  const handleAddSpot = (spot: Spot) => {
    setSpots([...spots, { ...spot, id: Date.now().toString() }])
    setIsAddDialogOpen(false)
  }

  const handleDeleteSpot = (id: string) => {
    setSpots(spots.filter((s) => s.id !== id))
  }

  const filteredSpots = selectedCategory === "all" ? spots : spots.filter((s) => s.category === selectedCategory)

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-balance">Travel Spots</h1>
            <p className="mt-2 text-sm text-muted-foreground">Save and organize your favorite places</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Spot
          </Button>
        </div>

        {/* Controls */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <CategoryFilter selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} spots={spots} />
          <ViewToggle view={view} onViewChange={setView} />
        </div>

        {/* Content */}
        {spots.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No spots added yet. Click "Add Spot" to get started.</p>
          </div>
        ) : view === "list" ? (
          <ListView spots={filteredSpots} onDeleteSpot={handleDeleteSpot} navigation={navigation} onNavigationChange={setNavigation} />
        ) : (
          <MapView spots={filteredSpots} navigation={navigation} />
        )}
      </div>

      <AddSpotDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onAddSpot={handleAddSpot} />
    </main>
  )
}
