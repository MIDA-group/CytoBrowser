#!/bin/bash
# Download and convert a Zeiss fluorescence image with 13 z-planes


#Exit on error (sourced or subshell)
trap 'echo Error $? on line $LINENO; trap - ERR; return 2>/dev/null || exit' ERR


#Download an example image - HER2 FISH, fluorescence, 3 channels, 13 Z-planes; credited to Yves Sucaet
file="Zeiss-1-Stacked.zvi"
curl -L -o "${file}" -C - https://openslide.cs.cmu.edu/download/openslide-testdata/Zeiss/Zeiss-1-Stacked.zvi
name="${file%.*}"

#Verify the image size
#bftools/showinf -nopix -nometa "${file}"


#Using Bio-Formats to extract one tiff for each z-level, note '_z' prefix for the z-offset
#"Command Line Tools" from https://www.openmicroscopy.org/bio-formats/downloads/

#Since bfconvert messes up the dimensions, we extract one z-level at a time in a for loop
mkdir -p tmp
for i in {0..12}; do
	bftools/bfconvert -merge -z $i "${file}" tmp/"${name}"_z$i.tiff
done


#Using libvips (https://www.libvips.org/install.html) to create Deep Zoom images (dzi)
mkdir -p data
for a in tmp/"${name}"_z*.tiff; do
	vips --vips-progress dzsave "$a" --tile-size 256 --overlap 0 --suffix .jpg[Q=90] data/"$(basename "$a" .tiff)"
	rm -f "$a"
done
rmdir --ignore-fail-on-non-empty tmp


printf "\nTo directly open this image, run:\n node cytobrowser.js --open-browser --query 'image=${name}'\n"
