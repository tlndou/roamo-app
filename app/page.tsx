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
    category: "Restaurant",
    name: "Moeder",
    city: "Amsterdam",
    country: "Netherlands",
    continent: "Europe",
    comments: "Order the soup",
    thumbnail: "/cozy-dutch-restaurant-interior.jpg",
    link: "https://www.restaurantmoeder.nl/",
    coordinates: { lat: 52.3676, lng: 4.8936 },
  },
  {
    id: "2",
    category: "Restaurant",
    name: "Le Comptoir du Relais",
    city: "Paris",
    country: "France",
    continent: "Europe",
    comments: "Amazing steak frites, reserve ahead",
    thumbnail: "/parisian-bistro.jpg",
    link: "https://www.hotel-paris-relais-saint-germain.com/",
    coordinates: { lat: 48.8529, lng: 2.3388 },
  },
  {
    id: "3",
    category: "Museum",
    name: "Rijksmuseum",
    city: "Amsterdam",
    country: "Netherlands",
    continent: "Europe",
    comments: "Don't miss The Night Watch",
    thumbnail: "/rijksmuseum-exterior.jpg",
    link: "https://www.rijksmuseum.nl/",
    coordinates: { lat: 52.36, lng: 4.8852 },
  },
  {
    id: "4",
    category: "Bar",
    name: "Tales & Spirits",
    city: "Amsterdam",
    country: "Netherlands",
    continent: "Europe",
    comments: "Best cocktails in the city",
    thumbnail: "/modern-cocktail-bar.jpg",
    link: "https://talesandspirits.com/",
    coordinates: { lat: 52.374, lng: 4.8897 },
  },
  {
    id: "5",
    category: "Restaurant",
    name: "Sukiyabashi Jiro",
    city: "Tokyo",
    country: "Japan",
    continent: "Asia",
    comments: "The legendary sushi place, book months ahead",
    thumbnail: "/tokyo-sushi-counter.jpg",
    link: "https://www.sushi-jiro.jp/",
    coordinates: { lat: 35.6675, lng: 139.7632 },
  },
  {
    id: "6",
    category: "Activity",
    name: "Fushimi Inari Shrine",
    city: "Kyoto",
    country: "Japan",
    continent: "Asia",
    comments: "Go early morning to avoid crowds",
    thumbnail: "/fushimi-inari-torii-gates.jpg",
    link: "http://inari.jp/en/",
    coordinates: { lat: 34.9671, lng: 135.7727 },
  },
  {
    id: "7",
    category: "Restaurant",
    name: "Osteria Francescana",
    city: "Modena",
    country: "Italy",
    continent: "Europe",
    comments: "3 Michelin stars, worth the splurge",
    thumbnail: "/fine-dining-italian-restaurant.jpg",
    link: "https://www.osteriafrancescana.it/",
    coordinates: { lat: 44.6471, lng: 10.9252 },
  },
  {
    id: "8",
    category: "Cafe",
    name: "Blue Bottle Coffee",
    city: "San Francisco",
    country: "United States",
    continent: "North America",
    comments: "Get the New Orleans iced coffee",
    thumbnail: "/modern-coffee-shop.png",
    link: "https://bluebottlecoffee.com/",
    coordinates: { lat: 37.7749, lng: -122.4194 },
  },
  {
    id: "9",
    category: "Activity",
    name: "Antelope Canyon",
    city: "Page",
    country: "United States",
    continent: "North America",
    comments: "Book a photography tour for best light",
    thumbnail: "/antelope-canyon-light-beams.jpg",
    coordinates: { lat: 36.8619, lng: -111.3743 },
  },
  {
    id: "10",
    category: "Restaurant",
    name: "Quintonil",
    city: "Mexico City",
    country: "Mexico",
    continent: "North America",
    comments: "Modern Mexican cuisine, incredible flavors",
    thumbnail: "/upscale-mexican-restaurant.jpg",
    link: "https://www.quintonil.com/",
    coordinates: { lat: 19.4326, lng: -99.1332 },
  },
  {
    id: "11",
    category: "Bar",
    name: "Employees Only",
    city: "New York",
    country: "United States",
    continent: "North America",
    comments: "Speakeasy vibes, amazing bartenders",
    thumbnail: "/speakeasy-bar-interior.jpg",
    link: "https://employeesonlynyc.com/",
    coordinates: { lat: 40.7331, lng: -74.002 },
  },
  {
    id: "12",
    category: "Activity",
    name: "Christ the Redeemer",
    city: "Rio de Janeiro",
    country: "Brazil",
    continent: "South America",
    comments: "Go at sunset for amazing views",
    thumbnail: "/christ-the-redeemer-statue-sunset.jpg",
    link: "https://sagradafamilia.org/",
    coordinates: { lat: -22.9519, lng: -43.2105 },
  },
  {
    id: "13",
    category: "Museum",
    name: "Louvre",
    city: "Paris",
    country: "France",
    continent: "Europe",
    comments: "Get there right at opening, go to Mona Lisa first",
    thumbnail: "/louvre-pyramid.jpg",
    link: "https://www.louvre.fr/",
    coordinates: { lat: 48.8606, lng: 2.3376 },
  },
  {
    id: "14",
    category: "Activity",
    name: "Sagrada Familia",
    city: "Barcelona",
    country: "Spain",
    continent: "Europe",
    comments: "Book tickets online in advance",
    thumbnail: "/sagrada-familia-interior.jpg",
    link: "https://sagradafamilia.org/",
    coordinates: { lat: 41.4036, lng: 2.1744 },
  },
  {
    id: "15",
    category: "Cafe",
    name: "Federal Cafe",
    city: "Barcelona",
    country: "Spain",
    continent: "Europe",
    comments: "Best brunch spot, get the avocado toast",
    thumbnail: "/modern-brunch-cafe.jpg",
    coordinates: { lat: 41.3874, lng: 2.1686 },
  },
]

export default function Home() {
  const [spots, setSpots] = useState<Spot[]>(SEED_DATA)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [view, setView] = useState<"list" | "map">("list")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

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
          <ListView spots={filteredSpots} onDeleteSpot={handleDeleteSpot} />
        ) : (
          <MapView spots={filteredSpots} />
        )}
      </div>

      <AddSpotDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onAddSpot={handleAddSpot} />
    </main>
  )
}
