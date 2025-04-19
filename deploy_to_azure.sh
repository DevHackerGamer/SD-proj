#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
ACR_NAME="sdarchive"
# Repository name within ACR (can be same as image or different)
ACR_REPOSITORY="sprint1" 
# Local Docker image name (CHANGE THIS to the name you used in 'docker build -t <name>:<tag>')
LOCAL_IMAGE_NAME="react-vite-archiveapp-sprint1" # <-- Updated based on your build command
# Tag for the image (CHANGE THIS to the tag you used in 'docker build -t <name>:<tag>')
IMAGE_TAG="latest" # <-- CHANGE THIS if needed (e.g., "v1.0", "beta")
WEBAPP_NAME="Archive"
RESOURCE_GROUP="ConstitutionalArchiveResources"
# --- End Configuration ---

# Construct the full ACR image path
ACR_IMAGE_FULL_NAME="${ACR_NAME}.azurecr.io/${ACR_REPOSITORY}:${IMAGE_TAG}"
LOCAL_IMAGE_FULL_NAME="${LOCAL_IMAGE_NAME}:${IMAGE_TAG}" # Assuming local build uses 'latest' tag by default

echo "--- Starting Azure Deployment ---"

# 1. Log in to Azure Container Registry
echo "Logging in to ACR: ${ACR_NAME}..."
az acr login --name ${ACR_NAME}

# 2. Tag the local Docker image for ACR
echo "Tagging local image '${LOCAL_IMAGE_FULL_NAME}' as '${ACR_IMAGE_FULL_NAME}'..."
docker tag ${LOCAL_IMAGE_FULL_NAME} ${ACR_IMAGE_FULL_NAME}

# 3. Push the image to ACR
echo "Pushing image '${ACR_IMAGE_FULL_NAME}' to ACR..."
docker push ${ACR_IMAGE_FULL_NAME}

# 4. Update Azure Web App container settings
# IMPORTANT: Removed hardcoded password. Ensure your Azure CLI login has permissions
# or configure service principal authentication for the web app.
echo "Updating Web App '${WEBAPP_NAME}' container configuration..."
az webapp config container set \
  --name ${WEBAPP_NAME} \
  --resource-group ${RESOURCE_GROUP} \
  --docker-custom-image-name ${ACR_IMAGE_FULL_NAME} \
  --docker-registry-server-url "https://${ACR_NAME}.azurecr.io"
  # --docker-registry-server-user <your-acr-username-or-sp-id> # Optional: If needed and not auto-detected
  # --docker-registry-server-password <your-acr-password-or-sp-secret> # Optional: If needed and not auto-detected

# 5. Restart the Azure Web App
echo "Restarting Web App '${WEBAPP_NAME}'..."
az webapp restart --name ${WEBAPP_NAME} --resource-group ${RESOURCE_GROUP}

# 6. Record the deployment (Save image as .tar archive named by sprint)
echo "Recording successful deployment by saving the image archive..."
# WARNING: This saves the full image as a .tar file, which can be very large.
# It's recommended to add *.tar to your .gitignore file.
# The image is already stored in ACR.

# Updated directory to save deployment records
DEPLOYMENT_RECORD_DIR="docker" 
# Create the directory if it doesn't exist
mkdir -p ${DEPLOYMENT_RECORD_DIR} 

# Define the output archive file name using the ACR_REPOSITORY variable
# This will create files like docker/sprint1.tar, docker/sprint2.tar etc.
ARCHIVE_FILE="${DEPLOYMENT_RECORD_DIR}/${ACR_REPOSITORY}.tar"

echo "Saving image '${ACR_IMAGE_FULL_NAME}' to '${ARCHIVE_FILE}'..."
# Use docker save to create the archive. Use the ACR-tagged name.
# This will overwrite the file if it already exists for the same sprint.
docker save ${ACR_IMAGE_FULL_NAME} -o ${ARCHIVE_FILE}

echo "Deployment image archive saved to: ${ARCHIVE_FILE}"
# Reminder about file size and Git
echo "WARNING: ${ARCHIVE_FILE} contains the full Docker image and may be very large."
echo "Consider adding '*.tar' to your .gitignore file."

echo "--- Deployment to Azure completed successfully! ---"

