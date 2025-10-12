#!/bin/bash
# Download and convert a Hamamatsu brightfield WSI with 1 z-plane


#Exit on error (sourced or subshell)
trap 'echo Error $? on line $LINENO; trap - ERR; return 2>/dev/null || exit' ERR

#First, verify that we have vips installed
vips --version

#Download a 1GB example image - Ki-67 stain, brightfield, circa 2012
file="OS-2.ndpi"
curl -L -o "${file}" -C - https://openslide.cs.cmu.edu/download/openslide-testdata/Hamamatsu/OS-2.ndpi
name="Hamamatsu-${file%.*}"

#Verify the image size
#bftools/showinf -nopix -nometa "${file}"

#Using libvips (https://www.libvips.org/install.html) to directly create Deep Zoom images (dzi)
# note the '_z0' suffix to indicate only the zero-level z-plane
mkdir -p data
vips --vips-progress dzsave "${file}" --tile-size 256 --overlap 0 --suffix '.jpg[Q=90]' data/"${name}"_z0


#If you have a z-stacked ndpi file, we suggest to use ndpisplit of NDPITools to extract the individual z-planes
# https://www.imnc.in2p3.fr/pagesperso/deroulers/software/ndpitools/


# Extract metadata with bftools/showinf
# https://www.openmicroscopy.org/bio-formats/downloads/

#bftools/showinf -nocore -no-sas -nopix -omexml -omexml-only "${file}" > "${name}".ome.xml
#node server/metadata.js "${name}".ome.xml data


printf "\nTo directly open this image, run:\n node cytobrowser.js --open-browser --query 'image=${name}'\n"
