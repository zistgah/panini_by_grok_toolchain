TIME=$(date +%s.%N)
VER=$(expr $(ls ../*.zip | tr "_." "\n" | grep v | tr -d "v" | sort -nu | tail -1) \+ 1)
mv ~/Downloads/panini-toolchain.zip ../panini_by_grok_toolchain_v${VER}.zip &&\
cd .. &&\
unzip -d panini_by_grok_toolchain_v${VER} panini_by_grok_toolchain_v${VER}.zip &&\
cd panini_by_grok_toolchain &&\
git checkout main &&\
git reset --hard &&\
cp -r ../panini_by_grok_toolchain_v${VER}/panini-toolchain/* ./ &&\
node tests/run.mjs &&\
node scripts/selfhost.mjs &&\
node scripts/prove_theorem.mjs &&\
mkdir -p attest/${TIME} &&\
mv MANIFEST.* attest/${TIME} || echo MANIFEST was not found!!! &&\
find . -type f | grep -v ".git/" | xargs git add -f &&\
git commit -m "Updated stage 6 beta - v${VER}" &&\
git push &&\
find . -type f | grep -v ".git/" | xargs sha256sum > MANIFEST.sha256 &&\
misty ots stamp MANIFEST.sha256 &&\
git add MANIFEST.* &&\
git commit -m "misty ots stamp @ ${TIME}" &&\
git push &&\
git checkout -b stage6_beta_v${VER} &&\
git push --set-upstream origin stage6_beta_v${VER} &&\
git checkout main &&\
echo "Done :)" || echo "Failed. Sorry :("

