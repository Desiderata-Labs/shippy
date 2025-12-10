# Earn A Slice Local Development

load("ext://uibutton", "cmd_button")

# Load Docker Compose services
docker_compose("docker-compose.yml")

# Database
dc_resource("postgres", labels=["Database"])

cmd_button(
    "Open Prisma Studio",
    argv=["sh", "-c", "pnpm db:studio"],
    resource="postgres",
    icon_name="visibility",
    text="Prisma Studio",
)

cmd_button(
    "Run Migrations",
    argv=["sh", "-c", "pnpm db:migrate:deploy"],
    resource="postgres",
    icon_name="upgrade",
    text="Deploy Migrations",
)

cmd_button(
    "Create Migration",
    argv=["sh", "-c", "pnpm db:migrate:create"],
    resource="postgres",
    icon_name="add",
    text="Create Migration",
)

cmd_button(
    "Generate Prisma Client",
    argv=["sh", "-c", "pnpm db:generate"],
    resource="postgres",
    icon_name="refresh",
    text="Generate Client",
)

print("PostgreSQL: localhost:5434 (postgres/postgres)")
print("Database: earn_a_slice")
print("")
print("Local DATABASE_URL: postgresql://postgres:postgres@localhost:5434/earn_a_slice")
