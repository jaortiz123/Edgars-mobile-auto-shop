#!/usr/bin/env python3
"""
Manual Mutation Testing Analysis for passwords.py
This script runs individual mutants and tests them against our test suite
"""

import os
import subprocess
from typing import Dict, List, Tuple


def get_mutant_list() -> List[str]:
    """Get list of all mutants from mutmut results"""
    result = subprocess.run(
        ["mutmut", "results"],
        capture_output=True,
        text=True,
        cwd="/Users/jesusortiz/Edgars-mobile-auto-shop/backend",
    )
    if result.returncode != 0:
        print(f"Error getting mutant list: {result.stderr}")
        return []

    mutants = []
    for line in result.stdout.strip().split("\n"):
        if "app.security.passwords" in line and ":" in line:
            mutant_name = line.split(":")[0].strip()
            mutants.append(mutant_name)

    return mutants


def run_test_against_mutant(mutant_name: str) -> Tuple[bool, str]:
    """Apply a mutant and run tests against it"""
    os.chdir("/Users/jesusortiz/Edgars-mobile-auto-shop/backend")

    # Apply the mutant
    apply_result = subprocess.run(["mutmut", "apply", mutant_name], capture_output=True, text=True)
    if apply_result.returncode != 0:
        return False, f"Failed to apply mutant: {apply_result.stderr}"

    # Run the tests
    test_result = subprocess.run(
        [
            "python",
            "-m",
            "pytest",
            "tests/test_app_security_passwords_unit.py",
            "-x",
            "--tb=no",
            "-q",
        ],
        capture_output=True,
        text=True,
        env=dict(os.environ, TEST_MODE="unit"),
    )

    # Restore original file
    subprocess.run(["git", "checkout", "app/security/passwords.py"], capture_output=True)

    # Test failed means mutant was caught (good)
    mutant_killed = test_result.returncode != 0

    return mutant_killed, test_result.stdout + test_result.stderr


def analyze_sample_mutants(sample_size: int = 10) -> Dict:
    """Analyze a sample of mutants to get mutation score"""
    mutants = get_mutant_list()
    print(f"Found {len(mutants)} total mutants")

    # Take a sample for analysis
    sample_mutants = mutants[:sample_size]
    print(f"Analyzing first {len(sample_mutants)} mutants...")

    results = {"total_tested": 0, "killed": 0, "survived": 0, "survivors": []}

    for i, mutant in enumerate(sample_mutants):
        print(f"Testing mutant {i+1}/{len(sample_mutants)}: {mutant}")

        killed, output = run_test_against_mutant(mutant)
        results["total_tested"] += 1

        if killed:
            results["killed"] += 1
            print("  ✓ KILLED")
        else:
            results["survived"] += 1
            results["survivors"].append(mutant)
            print("  ✗ SURVIVED")

    return results


def generate_mutation_report(results: Dict) -> str:
    """Generate a comprehensive mutation testing report"""
    if results["total_tested"] == 0:
        return "No mutants were tested."

    mutation_score = (results["killed"] / results["total_tested"]) * 100

    report = f"""
🧬 MUTATION TESTING REPORT - passwords.py
{'='*50}

📊 MUTATION SCORE: {mutation_score:.1f}%

📈 STATISTICS:
  • Total Mutants Tested: {results['total_tested']}
  • Killed (Caught by tests): {results['killed']}
  • Survived (Escaped detection): {results['survived']}

🎯 QUALITY ASSESSMENT:
"""

    if mutation_score >= 90:
        report += "  EXCELLENT - Your tests are very robust!"
    elif mutation_score >= 80:
        report += "  GOOD - Your tests catch most bugs."
    elif mutation_score >= 70:
        report += "  ACCEPTABLE - Room for improvement in test coverage."
    else:
        report += "  NEEDS IMPROVEMENT - Tests may miss critical bugs."

    if results["survivors"]:
        report += f"\n\n⚠️  SURVIVING MUTANTS ({len(results['survivors'])}):\n"
        for survivor in results["survivors"]:
            report += f"  • {survivor}\n"
        report += "\n💡 These surviving mutants indicate potential gaps in test coverage."

    return report


if __name__ == "__main__":
    print("🧬 Starting Mutation Testing Analysis for passwords.py")
    print("=" * 60)

    # Analyze a sample of mutants
    results = analyze_sample_mutants(25)  # Test 25 mutants for better coverage

    # Generate and display report
    report = generate_mutation_report(results)
    print(report)

    # Save report to file
    with open(
        "/Users/jesusortiz/Edgars-mobile-auto-shop/backend/mutation_test_report.md", "w"
    ) as f:
        f.write(report)

    print("\n📄 Full report saved to: mutation_test_report.md")
